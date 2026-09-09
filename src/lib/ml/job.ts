import { useKiln } from "@/lib/store";
import { clampTrainConfig } from "@/lib/types";
import { blobToRgb } from "./codec.ts";
import {
  loadWeights,
  memoryInfo,
  probeGpu,
  resolveRgb,
  stopTraining,
  trainDiffusion,
  type RgbSample,
} from "./diffusion.ts";
import { trainOnNode, trainOnRemote } from "./remote.ts";

export function trainReadiness(): {
  ok: boolean;
  reason: string | null;
  n: number;
} {
  const { images } = useKiln.getState();
  const n = images.filter((im) => im.caption.trim().length > 0 && im.url).length;
  if (n < 4) {
    return {
      ok: false,
      reason: "Voeg minstens vier afbeeldingen mét labels toe.",
      n,
    };
  }
  return { ok: true, reason: null, n };
}

async function collectSamples(size: number): Promise<RgbSample[]> {
  const { images } = useKiln.getState();
  const out: RgbSample[] = [];
  const lazy = size >= 256;
  for (const im of images) {
    const caption = im.caption.trim();
    if (!caption || !im.url) continue;
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

export async function startTrainJob(): Promise<void> {
  const ready = trainReadiness();
  if (!ready.ok) throw new Error(ready.reason ?? "Kan niet trainen");

  const store = useKiln.getState();
  if (store.status === "running" || store.status === "loading") {
    throw new Error("Er draait al een trainingsjob");
  }

  const jobId = `k-${crypto.randomUUID().slice(0, 8)}`;
  store.beginJob(jobId);
  const config = clampTrainConfig(store.config);
  if (config.batchSize !== store.config.batchSize) {
    await store.setConfig({ batchSize: config.batchSize });
    store.pushConsole(`batch verlaagd naar ${config.batchSize} voor ${config.imageSize}px`);
  }
  const compute = store.compute;
  const remoteUrl = compute.remoteUrl.trim();
  const useRemote = compute.mode === "remote" && remoteUrl.length > 0;
  const useNode = compute.mode === "node" || (compute.mode === "remote" && !remoteUrl);
  store.pushConsole(`compute  ${useRemote ? "remote" : useNode ? "gpu-node" : "local"}`);
  store.pushConsole(`size ${config.imageSize}  T=${config.timesteps}  epochs ${config.epochs}  batch ${config.batchSize}`);

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
    const onBatch = (done: number, total: number) => {
      useKiln.getState().setPrep(done, total);
    };

    let info;
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
      await loadWeights(result.weights, config.imageSize, config.timesteps);
      for (const log of result.logs) onEpoch(log);
    } else {
      const result = await trainDiffusion({
        samples,
        config,
        onEpoch,
        onStatus,
        onBatch,
      });
      info = { ...result.info, compute: "local" as const };
    }

    await useKiln.getState().setModelInfo(info, false);
    const done = useKiln.getState();
    done.setStatus("done");
    done.setTrainMessage("Job voltooid — diffusion-gewichten liggen vast.");
    done.pushConsole(
      `done  loss ${info.finalLoss.toFixed(4)}  ${info.params} params  ${info.backend}`,
    );
    try {
      done.setGpu(await probeGpu());
    } catch {
      /* ignore */
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Training mislukt";
    useKiln.getState().setStatus("error");
    useKiln.getState().setTrainMessage(msg);
    useKiln.getState().pushConsole(`error  ${msg}`);
    throw err;
  }
}

export function requestStop(): void {
  stopTraining();
  useKiln.getState().setTrainMessage("Stoppen na deze batch…");
  useKiln.getState().pushConsole("stop requested");
}