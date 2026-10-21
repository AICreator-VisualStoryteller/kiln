import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Pause, Play, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SafetensorsImport } from "@/components/safetensors-import";
import { useKiln } from "@/lib/store";
import { requestPauseTrain, requestResumeTrain, requestStop, startTrainJob, trainReadiness } from "@/lib/ml/job";
import { pingNode, pingRemote } from "@/lib/ml/remote";
import { downloadSafetensors, ensureBackend, loadWeights, probeGpu } from "@/lib/ml/diffusion";
import type { ComputeMode, ImageSize, ModelArch, TrainDevice } from "@/lib/types";
import { BATCH_SIZES, EPOCH_PRESETS, IMAGE_SIZES, maxBatchFor } from "@/lib/types";
import { cn, fileSlug, formatBytes, formatLoss } from "@/lib/utils";
import { triggerDownloadBlob } from "@/lib/ml/safetensors";

export function TrainView() {
  const config = useKiln((s) => s.config);
  const setConfig = useKiln((s) => s.setConfig);
  const compute = useKiln((s) => s.compute);
  const setCompute = useKiln((s) => s.setCompute);
  const status = useKiln((s) => s.status);
  const logs = useKiln((s) => s.logs);
  const trainMessage = useKiln((s) => s.trainMessage);
  const consoleLines = useKiln((s) => s.consoleLines);
  const jobId = useKiln((s) => s.jobId);
  const prepDone = useKiln((s) => s.prepDone);
  const prepTotal = useKiln((s) => s.prepTotal);
  const eta = useKiln((s) => s.eta);
  const resumeId = useKiln((s) => s.resumeId);
  const gallery = useKiln((s) => s.gallery);
  const resumeItem = gallery.find((g) => g.id === resumeId) ?? null;
  const modelInfo = useKiln((s) => s.modelInfo);
  const modelStale = useKiln((s) => s.modelStale);
  const modelReady = useKiln((s) => s.modelReady);
  const proofs = useKiln((s) => s.proofs);
  const images = useKiln((s) => s.images);
  const ready = useKiln((s) => s.ready);
  const [busy, setBusy] = useState(false);
  const [pingMsg, setPingMsg] = useState<string | null>(null);
  const [lrDraft, setLrDraft] = useState<string | null>(null);

  const check = trainReadiness();
  const running = status === "running" || status === "loading" || status === "paused";
  const paused = status === "paused";
  const last = logs[logs.length - 1];
  const progress =
    running && prepTotal > 0
      ? Math.round((prepDone / prepTotal) * 100)
      : running && config.epochs > 0
        ? Math.round(((last?.epoch ?? 0) / config.epochs) * 100)
        : status === "done"
          ? 100
          : 0;

  const chartData = useMemo(
    () => logs.map((l) => ({ epoch: l.epoch, loss: Number(l.loss.toFixed(4)) })),
    [logs],
  );

  async function onStart() {
    setBusy(true);
    try {
      const result = await startTrainJob(resumeId ? { resumeId } : undefined);
      useKiln.getState().setResumeId(null);
      toast.success(result.partial ? "Onaf model staat in de galerij" : "Training voltooid — model staat in de galerij");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Training mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    try {
      const name = await downloadSafetensors();
      toast.success(`Geëxporteerd: ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export mislukt");
    }
  }

  async function onPing() {
    setPingMsg("testen…");
    try {
      if (compute.device === "cpu" || compute.mode === "local") {
        await ensureBackend(compute.device === "cpu" ? "cpu" : "gpu");
        const info = await probeGpu();
        useKiln.getState().setGpu(info);
        setPingMsg(
          `${compute.device === "cpu" ? "CPU" : "GPU"} · ${info.backend} · ${info.renderer}`,
        );
      } else if (compute.remoteUrl.trim()) {
        const h = await pingRemote(compute.remoteUrl, compute.remoteToken);
        setPingMsg(`${h.name} · ${h.backend} · ${h.renderer}`);
      } else {
        const h = await pingNode();
        setPingMsg(`${h.name} · ${h.backend} · ${h.renderer}`);
      }
    } catch (err) {
      setPingMsg(err instanceof Error ? err.message : "geen verbinding");
    }
  }

  async function pickDevice(device: TrainDevice) {
    await setCompute(device === "cpu" ? { device, mode: "local" } : { device });
    try {
      await ensureBackend(device);
      const s = useKiln.getState();
      if (s.weightsDump && s.modelInfo) {
        await loadWeights(s.weightsDump, s.modelInfo.imageSize, s.modelInfo.timesteps);
        s.setModelReady(true);
      }
      s.setGpu(await probeGpu());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backend startte niet");
    }
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Studio laden…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Training</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Kies diffusion of een GAN. Diffusion blijft hetzelfde model. Een gepauzeerd
            of gestopt model komt vanzelf in de galerij, zodat je later verder traint.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <>
              {paused ? (
                <Button onClick={requestResumeTrain}>
                  <Play className="size-4" />
                  Hervatten
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={requestPauseTrain}
                  disabled={compute.mode !== "local" && config.arch !== "gan"}
                >
                  <Pause className="size-4" />
                  Pauze
                </Button>
              )}
              <Button variant="secondary" onClick={requestStop}>
                <Square className="size-4" />
                Stop
              </Button>
            </>
          ) : (
            <Button onClick={() => void onStart()} disabled={!check.ok || busy}>
              <Zap className="size-4" />
              {resumeItem ? "Verder trainen" : modelInfo ? "Opnieuw trainen" : "Job starten"}
            </Button>
          )}
          <SafetensorsImport disabled={running || busy} />
        </div>
      </div>

      <GpuNode jobId={jobId} />

      <section className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
        <h2 className="text-sm font-medium">Model</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["diffusion", "Diffusion"],
              ["gan", "GAN"],
            ] as [ModelArch, string][]
          ).map(([arch, label]) => (
            <button
              key={arch}
              type="button"
              disabled={running}
              onClick={() => void setConfig({ arch })}
              className={cn(
                "h-11 min-w-24 rounded-md px-3 text-sm",
                config.arch === arch
                  ? "bg-primary text-primary-foreground"
                  : "bg-elevated text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {config.arch === "gan"
            ? "Conditionele DCGAN: generator maakt beelden, discriminator leert echt van nep. Lokaal, pauzeerbaar."
            : "Conditioneel DDPM. Het U-Net voorspelt het schone beeld. Lokaal pauzeerbaar; GPU-server is diffusion."}
        </p>
        {resumeItem ? (
          <p className="text-xs text-muted-foreground">
            Verder vanaf <span className="text-foreground">{resumeItem.name}</span>
            {resumeItem.info.partial ? " (onaf)" : ""} · {resumeItem.info.imageSize}px. De job telt de gekozen epochs extra.
          </p>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Naam in de galerij</p>
          <Input
            value={config.modelName}
            disabled={running}
            placeholder="bijv. gezichten v1"
            onChange={(e) => void setConfig({ modelName: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
        <h2 className="text-sm font-medium">Compute</h2>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Apparaat</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["cpu", "CPU"],
                ["gpu", "GPU"],
              ] as [TrainDevice, string][]
            ).map(([device, label]) => (
              <button
                key={device}
                type="button"
                disabled={running}
                onClick={() => void pickDevice(device)}
                className={cn(
                  "h-11 min-w-20 rounded-md px-3 text-sm",
                  compute.device === device
                    ? "bg-primary text-primary-foreground"
                    : "bg-elevated text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {compute.device === "cpu" ? (
          <p className="text-xs text-muted-foreground">
            Training draait op de processor van dit apparaat. Werkt overal,
            langzamer dan GPU.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Waar</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["local", "Deze browser"],
                  ["remote", "GPU-server"],
                ] as [ComputeMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  disabled={running}
                  onClick={() => void setCompute({ mode, device: "gpu" })}
                  className={cn(
                    "h-11 rounded-md px-3 text-sm",
                    compute.mode === mode || (mode === "remote" && compute.mode === "node")
                      ? "bg-primary text-primary-foreground"
                      : "bg-elevated text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {compute.mode === "local" ? (
              <p className="text-xs text-muted-foreground">
                WebGL-GPU van dit apparaat. Echte backpropagation — aanbevolen.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Leeg = deze Kiln-node. Of plak de URL van een eigen node: GET
                  /health, POST /train.
                </p>
                <Input
                  value={compute.remoteUrl}
                  disabled={running}
                  placeholder="https://jouw-gpu-server"
                  onChange={(e) => void setCompute({ remoteUrl: e.target.value, device: "gpu" })}
                />
                <Input
                  value={compute.remoteToken}
                  disabled={running}
                  placeholder="Bearer-token (optioneel)"
                  onChange={(e) => void setCompute({ remoteToken: e.target.value, device: "gpu" })}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => void onPing()} disabled={running}>
            Test apparaat
          </Button>
          {pingMsg ? (
            <p className="font-mono text-xs text-muted-foreground">{pingMsg}</p>
          ) : null}
        </div>
      </section>

      {running ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{trainMessage}</p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {eta || (last ? `epoch ${last.epoch}/${config.epochs}` : "ETA na de eerste batch")}
            </p>
          </div>
          <Progress value={progress} />
        </div>
      ) : trainMessage && status === "error" ? (
        <p className="text-sm text-destructive">{trainMessage}</p>
      ) : null}

      {!check.ok ? (
        <div className="rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <h2 className="text-base font-medium">Nog niet klaar om te trainen</h2>
          <p className="mt-2 text-sm text-muted-foreground">{check.reason}</p>
          <Button asChild className="mt-5" variant="secondary">
            <Link to="/">Naar dataset</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="space-y-6 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <h2 className="text-sm font-medium">DDPM-config</h2>
          <Field label="Epochs" value={`${config.epochs} / max 64`}>
            <ChipRow
              disabled={running}
              options={EPOCH_PRESETS.map((v) => ({ value: String(v), label: String(v) }))}
              current={String(config.epochs)}
              onPick={(v) => void setConfig({ epochs: Number(v) })}
            />
            <Input
              type="number"
              min={1}
              max={64}
              step={1}
              disabled={running}
              value={config.epochs}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                void setConfig({ epochs: Math.min(64, Math.max(1, Math.round(n))) });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Elke epoch doet minstens 48 echte updates. 16 is een goed startpunt.
            </p>
          </Field>
          <Field label="Learning rate" value={String(config.learningRate)}>
            <Input
              type="number"
              inputMode="decimal"
              min={0.000001}
              max={0.1}
              step="any"
              disabled={running}
              value={lrDraft ?? String(config.learningRate)}
              onChange={(e) => setLrDraft(e.target.value)}
              onBlur={() => {
                const raw = (lrDraft ?? "").trim().replace(",", ".");
                const n = Number(raw);
                setLrDraft(null);
                if (!raw || !Number.isFinite(n)) return;
                void setConfig({ learningRate: n });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <p className="text-xs text-muted-foreground">Zelf invullen, bijv. 0.001 of 0.0005.</p>
          </Field>
          <Field label="Beeldmaat" value={`${config.imageSize}px`}>
            <ChipRow
              disabled={running}
              options={IMAGE_SIZES.map((v) => ({ value: String(v), label: String(v) }))}
              current={String(config.imageSize)}
              onPick={(v) => void setConfig({ imageSize: Number(v) as ImageSize })}
            />
          </Field>
          {config.imageSize >= 128 ? (
            <p className="text-xs text-muted-foreground">
              {config.imageSize}px is zwaar — lokaal op GPU, kleine batch. Bij 512px max{" "}
              {maxBatchFor(512)} tegelijk.
            </p>
          ) : null}
          <Field label="Timesteps T" value={String(config.timesteps)}>
            <ChipRow
              disabled={running}
              options={[
                { value: "12", label: "12" },
                { value: "20", label: "20" },
                { value: "40", label: "40" },
              ]}
              current={String(config.timesteps)}
              onPick={(v) => void setConfig({ timesteps: Number(v) })}
            />
          </Field>
          <Field label="Batch" value={String(config.batchSize)}>
            <ChipRow
              disabled={running}
              options={BATCH_SIZES.map((v) => ({
                value: String(v),
                label: String(v),
              }))}
              current={String(config.batchSize)}
              onPick={(v) => void setConfig({ batchSize: Number(v) })}
            />
          </Field>
          <p className="font-mono text-xs text-muted-foreground">
            {images.filter((im) => im.caption.trim()).length} gelabelde beelden
          </p>
          <ArchitectureTiny />
        </section>

        <section className="space-y-6">
          {consoleLines.length > 0 ? (
            <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
              <h2 className="mb-3 text-sm font-medium">Node-console</h2>
              <pre className="max-h-40 overflow-auto font-mono text-micro leading-relaxed text-muted-foreground">
                {consoleLines.map((line, i) => (
                  <div key={`${i}-${line}`}>{line}</div>
                ))}
              </pre>
            </div>
          ) : null}

          <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium">Noise-prediction loss</h2>
              {last ? (
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  mse {formatLoss(last.loss)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">wacht op epochs</p>
              )}
            </div>
            <div className="h-56">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="color-mix(in oklab, var(--color-foreground) 8%, transparent)" />
                    <XAxis
                      dataKey="epoch"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: "var(--color-elevated)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="loss"
                      stroke="var(--color-accent)"
                      dot={false}
                      strokeWidth={1.75}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="lab-grid flex h-full items-center justify-center rounded-lg">
                  <p className="text-sm text-muted-foreground">Start een job om de curve te zien</p>
                </div>
              )}
            </div>
          </div>

          {modelInfo ? (
            <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-medium">Getraind DDPM</h2>
                <Badge variant={modelStale ? "warning" : modelInfo.updates ? "success" : "accent"}>
                  {modelStale ? "verouderd t.o.v. data" : modelInfo.updates ? "klaar" : "geïmporteerd"}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat k="Parameters" v={modelInfo.params.toLocaleString("nl-NL")} />
                <Stat
                  k="Loss"
                  v={
                    modelInfo.firstLoss
                      ? `${formatLoss(modelInfo.firstLoss)}→${formatLoss(modelInfo.finalLoss)}`
                      : formatLoss(modelInfo.finalLoss)
                  }
                />
                <Stat k="Updates" v={String(modelInfo.updates || "—")} />
                <Stat k="Hash" v={modelInfo.weightHash || "—"} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <SafetensorsImport disabled={running || busy} />
                <Button
                  variant="secondary"
                  onClick={() => void onExport()}
                  disabled={!modelReady}
                >
                  <Download className="size-4" />
                  Exporteer .safetensors
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/lab">Beelden genereren</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {proofs.length > 0 ? (
            <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
              <h2 className="mb-3 text-sm font-medium">Samples uit dit model</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Native {modelInfo?.imageSize ?? 32}px — dezelfde resolutie als het model.
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {proofs.map((p) => (
                  <li key={p.url}>
                    <img
                      src={p.url}
                      alt={p.prompt}
                      className="aspect-square w-full rounded-md bg-elevated"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
                      {p.prompt}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        void fetch(p.url)
                          .then((r) => r.blob())
                          .then((blob) =>
                            triggerDownloadBlob(
                              blob,
                              `kiln-${fileSlug(p.prompt)}-${modelInfo?.imageSize ?? 32}px.png`,
                            ),
                          );
                      }}
                    >
                      Download PNG
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function GpuNode({ jobId }: { jobId: string | null }) {
  const gpu = useKiln((s) => s.gpu);
  const status = useKiln((s) => s.status);
  const compute = useKiln((s) => s.compute);
  const live = status === "running" || status === "loading";
  const name =
    compute.device === "cpu"
      ? "kiln-cpu-0"
      : compute.mode === "local"
        ? "kiln-gpu-0"
        : compute.remoteUrl.trim()
          ? "remote-gpu"
          : "kiln-node-0";
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-2 rounded-full",
            live ? "gpu-live bg-accent" : "bg-muted-foreground/40",
          )}
        />
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="max-w-md truncate text-xs text-muted-foreground">
            {gpu?.renderer ?? (compute.device === "cpu" ? "CPU klaarzetten…" : "GPU detecteren…")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
        <span>backend {gpu?.backend ?? "—"}</span>
        <span>tensors {gpu?.numTensors ?? 0}</span>
        <span>{formatBytes(gpu?.numBytes ?? 0)}</span>
        <span>{jobId ?? "idle"}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-xs tabular-nums">{value}</p>
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  current,
  onPick,
  disabled,
}: {
  options: { value: string; label: string }[];
  current: string;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(opt.value)}
          className={cn(
            "h-9 rounded-md px-2.5 text-xs transition-colors duration-150",
            current === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-elevated text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ArchitectureTiny() {
  const layers = ["x", "enc", "down×3", "bot", "up×3", "eps"];
  return (
    <div className="flex flex-wrap gap-1">
      {layers.map((name) => (
        <span
          key={name}
          className="rounded-md bg-elevated px-2 py-1 font-mono text-xs text-muted-foreground"
        >
          {name}
        </span>
      ))}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums">{v}</dd>
    </div>
  );
}
