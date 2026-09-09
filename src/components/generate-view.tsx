import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useKiln } from "@/lib/store";
import { hasModel, loadSavedModel, sampleDiffusion } from "@/lib/ml/diffusion";
import { imageDataToPngBlob, upscaleNearest } from "@/lib/ml/codec";
import { EXAMPLE_PROMPTS } from "@/lib/ml/sample";

type Shot = { id: string; prompt: string; url: string };

export function GenerateView() {
  const modelInfo = useKiln((s) => s.modelInfo);
  const modelStale = useKiln((s) => s.modelStale);
  const ready = useKiln((s) => s.ready);
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0] ?? "");
  const [steps, setSteps] = useState(8);
  const [guidance, setGuidance] = useState(1.4);
  const [busy, setBusy] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  async function onGenerate() {
    const p = prompt.trim();
    if (!p) {
      toast.error("Typ een prompt");
      return;
    }
    if (!hasModel()) {
      if (modelInfo) {
        const ok = await loadSavedModel(modelInfo.imageSize, modelInfo.timesteps);
        if (!ok) {
          toast.error("Gewichten nog niet geladen — train opnieuw");
          return;
        }
      } else {
        toast.error("Nog geen getraind model in geheugen");
        return;
      }
    }
    setBusy(true);
    setStepLabel("ruis…");
    try {
      const frame = await sampleDiffusion({
        prompt: p,
        steps,
        guidance,
        onStep: (img, step, total) => {
          paint(img);
          setStepLabel(`denoise ${step}/${total}`);
        },
      });
      paint(frame);
      const blob = await imageDataToPngBlob(upscaleNearest(frame, 256));
      const url = URL.createObjectURL(blob);
      setShots((prev) => [{ id: crypto.randomUUID(), prompt: p, url }, ...prev].slice(0, 12));
      setStepLabel("klaar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generatie mislukt");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Studio laden…</p>;
  }

  if (!modelInfo) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-medium tracking-tight">Genereren</h1>
        <p className="text-sm text-muted-foreground">
          Train eerst een diffusion-model. Daarna type je een prompt en zie je
          ruis in stappen een beeld worden — uit jouw gewichten.
        </p>
        <Button asChild>
          <Link to="/train">Naar training</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Genereren</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Weinig stappen: het netwerk voorspelt meteen het schone beeld, daarna
            een korte refine. Intern {modelInfo.imageSize}px, scherp opgeschaald.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modelStale ? <Badge variant="warning">model verouderd</Badge> : null}
          <Badge variant="muted">
            {modelInfo.imageSize}px · T={modelInfo.timesteps}
          </Badge>
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
          <p className="font-mono text-xs text-muted-foreground">{stepLabel || "wacht op prompt"}</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Prompt</p>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="een rode cirkel op donkere achtergrond"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onGenerate();
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((p) => (
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
              max={2.5}
              step={0.1}
              value={[guidance]}
              disabled={busy}
              onValueChange={([v]) => setGuidance(v ?? 1.4)}
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
          <h2 className="text-sm font-medium">Recente samples</h2>
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
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
