import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SafetensorsImport } from "@/components/safetensors-import";
import { useKiln } from "@/lib/store";
import {
  downloadSafetensors,
  hasTrainedModel,
  loadSavedModel,
  loadWeights,
  sampleDiffusion,
} from "@/lib/ml/diffusion";
import { hasGanModel, loadGanWeights, sampleGan } from "@/lib/ml/gan";
import { imageDataToPngBlob, upscaleNearest } from "@/lib/ml/codec";
import { triggerDownloadBlob } from "@/lib/ml/safetensors";
import { EXAMPLE_PROMPTS } from "@/lib/ml/sample";
import { FRUIT_LEGEND, FRUIT_PROMPTS, isFruitCode } from "@/lib/ml/fruit";
import { fileSlug } from "@/lib/utils";

type Shot = { id: string; prompt: string; url: string; size: number };

export function GenerateView() {
  const modelInfo = useKiln((s) => s.modelInfo);
  const modelStale = useKiln((s) => s.modelStale);
  const modelReady = useKiln((s) => s.modelReady);
  const weightsDump = useKiln((s) => s.weightsDump);
  const status = useKiln((s) => s.status);
  const ready = useKiln((s) => s.ready);
  const images = useKiln((s) => s.images);
  const fruitMode = useMemo(
    () => images.filter((im) => isFruitCode(im.caption)).length >= 8,
    [images],
  );
  const prompts = fruitMode ? FRUIT_PROMPTS : EXAMPLE_PROMPTS;
  const [prompt, setPrompt] = useState(prompts[0] ?? "");
  const [steps, setSteps] = useState(8);
  const [guidance, setGuidance] = useState(1.8);
  const [busy, setBusy] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrame = useRef<ImageData | null>(null);
  const training = status === "running" || status === "loading";

  useEffect(() => {
    if (!prompt || (fruitMode && !isFruitCode(prompt))) {
      setPrompt(prompts[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fruitMode]);

  useEffect(() => {
    return () => {
      for (const s of shots) URL.revokeObjectURL(s.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paint(data: ImageData) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shown = data.width >= 256 ? data : upscaleNearest(data, 256);
    canvas.width = shown.width;
    canvas.height = shown.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(shown, 0, 0);
  }

  async function ensureTrained(): Promise<boolean> {
    if (modelInfo?.arch === "gan") {
      if (hasGanModel()) return true;
      if (weightsDump && modelInfo) {
        await loadGanWeights(weightsDump, modelInfo.imageSize);
        return hasGanModel();
      }
      return false;
    }
    if (hasTrainedModel()) return true;
    if (weightsDump && modelInfo) {
      await loadWeights(weightsDump, modelInfo.imageSize, modelInfo.timesteps);
      return hasTrainedModel();
    }
    if (modelInfo) {
      const ok = await loadSavedModel(modelInfo.imageSize, modelInfo.timesteps);
      return ok && hasTrainedModel();
    }
    return false;
  }

  async function onGenerate() {
    const p = prompt.trim();
    if (!p) {
      toast.error("Typ een prompt");
      return;
    }
    if (training) {
      toast.error("Training loopt nog — de generator wacht op echte gewichten");
      return;
    }
    const ok = await ensureTrained();
    if (!ok) {
      toast.error("Nog geen getraind model — train of importeer .safetensors");
      return;
    }
    setBusy(true);
    setStepLabel("ruis…");
    try {
      const frame =
        modelInfo?.arch === "gan"
          ? await sampleGan({ prompt: p })
          : await sampleDiffusion({
              prompt: p,
              steps,
              guidance,
              onStep: (img, step, total) => {
                paint(img);
                setStepLabel(`denoise ${step}/${total}`);
              },
            });
      lastFrame.current = frame;
      paint(frame);
      const blob = await imageDataToPngBlob(frame);
      const url = URL.createObjectURL(blob);
      setShots((prev) =>
        [{ id: crypto.randomUUID(), prompt: p, url, size: frame.width }, ...prev].slice(0, 12),
      );
      setStepLabel(`klaar · ${frame.width}×${frame.height}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generatie mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onExportModel() {
    try {
      const ok = await ensureTrained();
      if (!ok) throw new Error("Nog geen getraind model");
      const name = await downloadSafetensors();
      toast.success(`Geëxporteerd: ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export mislukt");
    }
  }

  async function onExportImage(url: string, p: string, size: number) {
    const res = await fetch(url);
    const blob = await res.blob();
    triggerDownloadBlob(blob, `kiln-${fileSlug(p)}-${size}px.png`);
  }

  async function onExportLast() {
    const frame = lastFrame.current;
    if (!frame) {
      toast.error("Genereer eerst een beeld");
      return;
    }
    const blob = await imageDataToPngBlob(frame);
    triggerDownloadBlob(blob, `kiln-${fileSlug(prompt)}-${frame.width}px.png`);
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Studio laden…</p>;
  }

  if (!modelInfo || !modelReady || training) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-medium tracking-tight">Genereren</h1>
        <p className="text-sm text-muted-foreground">
          {training
            ? "Training loopt. De generator is vergrendeld tot de gewichten écht zijn bijgewerkt."
            : "Train een model, of laad een eerder geëxporteerd .safetensors-bestand."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/train">{training ? "Naar training" : "Eerst trainen"}</Link>
          </Button>
          {!training ? <SafetensorsImport /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Genereren</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {fruitMode
              ? "Typ een fruitcode (A, AB, G, GB, …) — dezelfde labels als waarop je trainde."
              : "Sampling uit jouw getrainde U-Net. Andere prompt = andere conditie."}{" "}
            Export is {modelInfo.imageSize}×{modelInfo.imageSize} px, zonder opschalen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modelStale ? <Badge variant="warning">model verouderd</Badge> : null}
          <Badge variant={modelInfo.updates ? "success" : "accent"}>
            {modelInfo.updates ? "getraind" : "geïmporteerd"}
          </Badge>
          <Badge variant="muted">
            {modelInfo.imageSize}px · T={modelInfo.timesteps}
          </Badge>
          <SafetensorsImport size="sm" disabled={busy} />
          <Button variant="secondary" size="sm" onClick={() => void onExportModel()}>
            <Download className="size-4" />
            .safetensors
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-4">
          <div className="lab-grid flex aspect-square max-h-[28rem] items-center justify-center overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs text-muted-foreground">
              {stepLabel || "wacht op prompt"}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onExportLast()}
              disabled={!lastFrame.current || busy}
            >
              <Download className="size-4" />
              PNG {modelInfo.imageSize}px
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Prompt</p>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={fruitMode ? "A" : "een rode cirkel op donkere achtergrond"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onGenerate();
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="rounded-full bg-elevated px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
          {fruitMode ? (
            <ul className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              {FRUIT_LEGEND.map((g) => (
                <li key={g.code}>
                  <span className="font-mono text-foreground">{g.code}</span> {g.name}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Refine-stappen</p>
              <p className="font-mono text-xs tabular-nums">{steps}</p>
            </div>
            <Slider
              min={4}
              max={12}
              step={1}
              value={[steps]}
              disabled={busy}
              onValueChange={([v]) => setSteps(v ?? 8)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Guidance</p>
              <p className="font-mono text-xs tabular-nums">{guidance.toFixed(1)}</p>
            </div>
            <Slider
              min={1}
              max={3}
              step={0.1}
              value={[guidance]}
              disabled={busy}
              onValueChange={([v]) => setGuidance(v ?? 1.8)}
            />
          </div>
          <Button className="w-full" onClick={() => void onGenerate()} disabled={busy}>
            <Sparkles className="size-4" />
            {busy ? "Denoisen…" : "Genereren"}
          </Button>
        </div>
      </div>

      {shots.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Recente samples · native {shots[0]?.size}px</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shots.map((s) => (
              <li key={s.id}>
                <img
                  src={s.url}
                  alt={s.prompt}
                  className="aspect-square w-full rounded-md bg-elevated"
                  style={{ imageRendering: "pixelated" }}
                />
                <p className="mt-1.5 truncate text-xs text-muted-foreground">{s.prompt}</p>
                <button
                  type="button"
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => void onExportImage(s.url, s.prompt, s.size)}
                >
                  Download {s.size}px PNG
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
