import { useKiln } from "@/lib/store";
import { clampTrainConfig } from "@/lib/types";
import { blobToRgb, imageDataToPngBlob } from "./codec.ts";
import {
  hasTrainedModel,
  importSafetensors,
  loadSavedModel,
  loadWeights,
  markUntrained,
  memoryInfo,
  probeGpu,
  resolveRgb,
  sampleDiffusion,
  stopTraining,
  trainDiffusion,
  dumpWeights,
  type RgbSample,
} from "./diffusion.ts";
import { trainOnNode, trainOnRemote } from "./remote.ts";
import { disposeGan, hasGanModel, loadGanWeights, sampleGan, snapshotGan, trainGan } from "./gan.ts";
import { requestAbort, requestPause, requestResume, resetTrainControl } from "./train-control.ts";

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "nog een paar seconden";
  if (s < 60) return `nog ~${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `nog ~${m}m ${String(r).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `nog ~${h}u ${m % 60}m`;
}

export function trainReadiness(): {
  ok: boolean;
  reason: string | null;
  n: number;
  labeled: number;
} {
  const { images } = useKiln.getState();
  const usable = images.filter((im) => im.url);
  const n = usable.length;
  const labeled = usable.filter((im) => im.caption.trim().length > 0).length;
  if (n < 4) {
    return {
      ok: false,
      reason: "Voeg minstens vier afbeeldingen toe. Labels zijn optioneel.",
      n,
      labeled,
    };
  }
  return { ok: true, reason: null, n, labeled };
}

async function collectSamples(size: number): Promise<RgbSample[]> {
  const { images } = useKiln.getState();
  const out: RgbSample[] = [];
  const lazy = size >= 256;
  for (const im of images) {
    if (!im.url) continue;
    const caption = im.caption.trim();
    const url = im.url;
    const load = async () => {
      const res = await fetch(url);
      const blob = await res.blob();
      return blobToRgb(blob, size);
    };
    if (lazy) {
      out.push({ caption, load });
    } else {
      out.push({ caption, rgb: await load() });
    }
  }
  return out;
}

async function restorePrevious(): Promise<boolean> {
  const s = useKiln.getState();
  try {
    if (s.weightsDump && s.modelInfo) {
      await loadWeights(s.weightsDump, s.modelInfo.imageSize, s.modelInfo.timesteps);
      s.setModelReady(true);
      return true;
    }
    if (s.modelInfo) {
      const ok = await loadSavedModel(s.modelInfo.imageSize, s.modelInfo.timesteps);
      s.setModelReady(ok);
      return ok;
    }
  } catch {
    /* ignore */
  }
  s.setModelReady(false);
  return false;
}

async function makeProofs(captions: string[], arch: "gan" | "diffusion"): Promise<Blob | null> {
  const can = arch === "gan" ? hasGanModel() : hasTrainedModel();
  if (!can) return null;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const c of captions) {
    const k = c.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(k);
    if (unique.length >= 8) break;
  }
  if (!unique.length) unique.push(arch === "gan" ? "portrait" : "");
  const shots: { prompt: string; url: string }[] = [];
  let preview: Blob | null = null;
  for (const prompt of unique) {
    const frame =
      arch === "gan"
        ? await sampleGan({ prompt })
        : await sampleDiffusion({ prompt, steps: 8, guidance: 1.8 });
    const blob = await imageDataToPngBlob(frame);
    if (!preview) preview = blob;
    shots.push({ prompt, url: URL.createObjectURL(blob) });
  }
  useKiln.getState().setProofs(shots);
  return preview;
}

export async function startTrainJob(opts?: { resumeId?: string }): Promise<{ partial: boolean }> {
  const ready = trainReadiness();
  if (!ready.ok) throw new Error(ready.reason ?? "Kan niet trainen");

  const store = useKiln.getState();
  if (store.status === "running" || store.status === "loading" || store.status === "paused") {
    throw new Error("Er draait al een trainingsjob");
  }

  const jobId = `k-${crypto.randomUUID().slice(0, 8)}`;
  store.beginJob(jobId);
  resetTrainControl();
  const arch = store.config.arch === "gan" ? "gan" : "diffusion";
  if (arch === "gan") disposeGan();
  else markUntrained();
  const config = clampTrainConfig(store.config);
  if (config.batchSize !== store.config.batchSize) {
    await store.setConfig({ batchSize: config.batchSize });
    store.pushConsole(`batch verlaagd naar ${config.batchSize} voor ${config.imageSize}px`);
  }
  const compute = store.compute;
  const device = compute.device === "cpu" ? "cpu" : "gpu";
  const remoteUrl = compute.remoteUrl.trim();
  const useRemote =
    arch === "diffusion" && device === "gpu" && compute.mode === "remote" && remoteUrl.length > 0;
  const useNode =
    arch === "diffusion" &&
    device === "gpu" &&
    (compute.mode === "node" || (compute.mode === "remote" && !remoteUrl));
  store.pushConsole(
    `arch  ${arch}  device  ${device}  compute  ${useRemote ? "remote-gpu" : useNode ? "gpu-node" : device === "cpu" ? "local-cpu" : "local-gpu"}`,
  );
  store.pushConsole(
    `size ${config.imageSize}  T=${config.timesteps}  epochs ${config.epochs}  batch ${config.batchSize}  lr ${config.learningRate}`,
  );

  let resume: import("@/lib/types").WeightDump | undefined;
  let galleryId = crypto.randomUUID();
  if (opts?.resumeId) {
    const entry = store.gallery.find((g) => g.id === opts.resumeId);
    if (!entry) throw new Error("Model niet gevonden");
    if (entry.arch !== arch) throw new Error("Dit model is een andere architectuur");
    if (entry.info.imageSize !== config.imageSize) {
      throw new Error("Zet de resolutie gelijk aan het opgeslagen model");
    }
    resume = entry.weights;
    galleryId = entry.id;
    store.pushConsole(`verder vanaf ${entry.name}`);
  }

  try {
    store.pushConsole("beelden naar RGB tensors…");
    const samples = await collectSamples(config.imageSize);
    store.pushConsole(`samples  ${samples.length}`);
    store.setStatus("running");

    const onEpoch = (log: { epoch: number; loss: number; seconds: number }) => {
      const s = useKiln.getState();
      s.pushLog(log);
      s.pushConsole(
        `epoch ${String(log.epoch).padStart(2, "0")}  loss ${log.loss.toFixed(4)}  ${log.seconds.toFixed(2)}s`,
      );
      const mem = memoryInfo();
      if (s.gpu) s.setGpu({ ...s.gpu, ...mem });
    };
    const onStatus = (msg: string) => {
      const s = useKiln.getState();
      s.setTrainMessage(msg);
      s.pushConsole(msg);
    };
    const startedAt = performance.now();
    let pausedMs = 0;
    let pauseAt = 0;
    const onBatch = (done: number, total: number) => {
      const now = performance.now();
      const livePause = pauseAt ? now - pauseAt : 0;
      const elapsed = Math.max(1, now - startedAt - pausedMs - livePause);
      const eta = done > 0 ? formatEta(((total - done) * elapsed) / done) : "ETA na de eerste batch";
      useKiln.getState().setPrep(done, total, eta);
    };

    const onPaused = (paused: boolean) => {
      const s = useKiln.getState();
      if (s.status === "error" || s.status === "done") return;
      if (paused) pauseAt = performance.now();
      else if (pauseAt) {
        pausedMs += performance.now() - pauseAt;
        pauseAt = 0;
      }
      s.setStatus(paused ? "paused" : "running");
      s.setTrainMessage(paused ? "Gepauzeerd — checkpoint gaat naar de galerij." : "Training hervat…");
      if (paused) {
        void (async () => {
          try {
            const weights = arch === "gan" ? await snapshotGan() : await dumpWeights();
            if (!weights) return;
            const name =
              useKiln.getState().config.modelName.trim() ||
              `${arch === "gan" ? "GAN" : "Diffusion"} ${new Date().toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
            const logs = useKiln.getState().logs;
            const last = logs[logs.length - 1];
            await useKiln.getState().publishModel({
              id: galleryId,
              name,
              createdAt: Date.now(),
              arch,
              info: {
                params: 0,
                layers: [],
                imageSize: config.imageSize,
                timesteps: arch === "gan" ? 0 : config.timesteps,
                trainedAt: Date.now(),
                finalLoss: last?.loss ?? 0,
                firstLoss: logs[0]?.loss ?? last?.loss ?? 0,
                backend: device,
                epochs: config.epochs,
                epochsDone: last?.epoch ?? 0,
                partial: true,
                sampleCount: samples.length,
                compute: "local",
                weightHash: "",
                updates: last?.epoch ?? 0,
                arch,
              },
              weights,
              preview: null,
            });
            useKiln.getState().pushConsole(`galerij  pauze-checkpoint  ${name}`);
          } catch (err) {
            useKiln.getState().pushConsole(
              `checkpoint  ${err instanceof Error ? err.message : "mislukt"}`,
            );
          }
        })();
      }
    };

    let info;
    let weights;
    if (useRemote) {
      const readySamples: RgbSample[] = [];
      for (const s of samples) {
        readySamples.push({ caption: s.caption, rgb: await resolveRgb(s) });
      }
      const result = await trainOnRemote({
        baseUrl: remoteUrl,
        token: compute.remoteToken,
        samples: readySamples,
        config,
        onEpoch,
        onStatus,
      });
      info = result.info;
      weights = result.weights;
      await loadWeights(result.weights, config.imageSize, config.timesteps);
    } else if (useNode) {
      const readySamples: RgbSample[] = [];
      for (const s of samples) {
        readySamples.push({ caption: s.caption, rgb: await resolveRgb(s) });
      }
      const result = await trainOnNode({
        samples: readySamples,
        config,
        onStatus,
      });
      info = result.info;
      weights = result.weights;
      await loadWeights(result.weights, config.imageSize, config.timesteps);
      for (const log of result.logs) onEpoch(log);
    } else if (arch === "gan") {
      if (compute.mode !== "local") {
        store.pushConsole("GAN draait lokaal — de GPU-server is alleen voor diffusion");
      }
      const result = await trainGan({
        samples,
        config,
        device,
        onEpoch,
        onStatus,
        onBatch,
        onPaused,
        resume,
      });
      info = result.info;
      weights = result.weights;
    } else {
      const result = await trainDiffusion({
        samples,
        config,
        device,
        onEpoch,
        onStatus,
        onBatch,
        onPaused,
        resume,
      });
      info = { ...result.info, compute: "local" as const, arch: "diffusion" as const };
      weights = result.weights;
    }

    const archFixed: "gan" | "diffusion" = info.arch === "gan" ? "gan" : "diffusion";
    info = { ...info, arch: archFixed };

    await useKiln.getState().setWeightsDump(weights);
    await useKiln.getState().setModelInfo(info, false);
    useKiln.getState().setModelReady(true);
    const done = useKiln.getState();
    done.setStatus("done");
    const drop =
      info.firstLoss > 0 ? `  ${info.firstLoss.toFixed(3)}→${info.finalLoss.toFixed(3)}` : "";
    done.setTrainMessage(`Job voltooid — ${info.updates} echte gradient-updates${drop}.`);
    done.pushConsole(
      `done  loss ${info.finalLoss.toFixed(4)}  ${info.params} params  hash ${info.weightHash}  ${info.backend}`,
    );
    try {
      done.setGpu(await probeGpu());
    } catch {
      /* ignore */
    }
    let preview: Blob | null = null;
    try {
      done.setTrainMessage("Eerste samples uit jouw gewichten…");
      preview = await makeProofs(
        samples.map((s) => s.caption),
        info.arch === "gan" ? "gan" : "diffusion",
      );
    } catch (err) {
      done.pushConsole(`proof  ${err instanceof Error ? err.message : "mislukt"}`);
    }
    const named =
      store.config.modelName.trim() ||
      `${info.arch === "gan" ? "GAN" : "Diffusion"} ${new Date().toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    await useKiln.getState().publishModel({
      id: galleryId,
      name: named,
      createdAt: Date.now(),
      arch: archFixed,
      info,
      weights,
      preview,
    });
    useKiln.getState().pushConsole(`galerij  ${named}`);
    useKiln.getState().setTrainMessage(
      info.partial
        ? "Onaf model staat in de galerij — laad het en kies Verder trainen."
        : "Klaar — model staat in de galerij. Je kunt de naam nog wijzigen.",
    );
    return { partial: Boolean(info.partial) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Training mislukt";
    const restored = await restorePrevious();
    useKiln.getState().setStatus("error");
    useKiln.getState().setTrainMessage(restored ? `${msg} — vorig model teruggezet` : msg);
    useKiln.getState().pushConsole(`error  ${msg}`);
    throw err;
  }
}

export function requestStop(): void {
  stopTraining();
  requestAbort();
  useKiln.getState().setTrainMessage("Stoppen na deze batch…");
  useKiln.getState().pushConsole("stop requested");
}

export function requestPauseTrain(): void {
  const s = useKiln.getState();
  if (s.status !== "running" && s.status !== "loading") return;
  requestPause();
  s.setStatus("paused");
  s.setTrainMessage("Pauzeren na deze batch…");
  s.pushConsole("pause requested");
}

export function requestResumeTrain(): void {
  const s = useKiln.getState();
  if (s.status !== "paused") return;
  requestResume();
  s.setStatus("running");
  s.setTrainMessage("Training hervat…");
  s.pushConsole("resume");
}

export async function activateGalleryModel(id: string): Promise<void> {
  const store = useKiln.getState();
  if (store.status === "running" || store.status === "loading" || store.status === "paused") {
    throw new Error("Stop eerst de trainingsjob");
  }
  const entry = store.gallery.find((g) => g.id === id);
  if (!entry) throw new Error("Model niet gevonden");
  if (entry.arch === "gan") {
    const { disposeModel } = await import("./diffusion.ts");
    await disposeModel();
    await loadGanWeights(entry.weights, entry.info.imageSize);
  } else {
    disposeGan();
    markUntrained();
    await loadWeights(entry.weights, entry.info.imageSize, entry.info.timesteps || 20);
  }
  await store.setWeightsDump(entry.weights);
  await store.setModelInfo(entry.info, false);
  store.setModelReady(true);
  store.setActiveGalleryId(id);
  store.setTrainMessage(`${entry.name} geladen`);
}

export async function installImportedModel(file: File) {
  const store = useKiln.getState();
  if (store.status === "running" || store.status === "loading") {
    throw new Error("Stop eerst de trainingsjob");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { info, weights } = await importSafetensors(bytes);
  await store.setWeightsDump(weights);
  await store.setModelInfo(info, false);
  store.setModelReady(true);
  store.pushConsole(
    `imported  ${info.imageSize}px  T=${info.timesteps}  ${info.params} params  hash ${info.weightHash}`,
  );
  store.setTrainMessage(`Model geïmporteerd · ${info.imageSize}px · ${info.params} parameters`);
  return info;
}
