import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Flame, Images, Library, LineChart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKiln } from "@/lib/store";
import { loadSavedModel, loadWeights, probeGpu, ensureBackend, setMeta } from "@/lib/ml/diffusion";
import { loadGanWeights } from "@/lib/ml/gan";

const NAV = [
  { to: "/", label: "Data", icon: Images },
  { to: "/train", label: "Trainen", icon: LineChart },
  { to: "/gallery", label: "Galerij", icon: Library },
  { to: "/lab", label: "Genereren", icon: Sparkles },
] as const;

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useKiln((s) => s.hydrate);
  const setGpu = useKiln((s) => s.setGpu);
  const ready = useKiln((s) => s.ready);
  const gpu = useKiln((s) => s.gpu);
  const images = useKiln((s) => s.images);
  const modelInfo = useKiln((s) => s.modelInfo);
  const modelStale = useKiln((s) => s.modelStale);
  const modelReady = useKiln((s) => s.modelReady);
  const status = useKiln((s) => s.status);
  const jobId = useKiln((s) => s.jobId);
  const compute = useKiln((s) => s.compute);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrate();
      if (cancelled) return;
      try {
        const device = useKiln.getState().compute.device === "cpu" ? "cpu" : "gpu";
        await ensureBackend(device);
        const info = await probeGpu();
        if (!cancelled) setGpu(info);
      } catch {
        if (!cancelled)
          setGpu({ backend: "cpu", renderer: "niet beschikbaar", numTensors: 0, numBytes: 0 });
      }
      const state = useKiln.getState();
      try {
        if (state.weightsDump && state.modelInfo?.arch === "gan") {
          await loadGanWeights(state.weightsDump, state.modelInfo.imageSize);
          if (!cancelled) state.setModelReady(true);
        } else if (state.weightsDump && state.modelInfo) {
          await loadWeights(
            state.weightsDump,
            state.modelInfo.imageSize,
            state.modelInfo.timesteps,
          );
          if (!cancelled) state.setModelReady(true);
        } else if (state.modelInfo) {
          const ok = await loadSavedModel(state.modelInfo.imageSize, state.modelInfo.timesteps);
          if (ok) {
            setMeta(state.modelInfo.imageSize, state.modelInfo.timesteps);
            if (!cancelled) state.setModelReady(true);
          } else if (!cancelled) {
            await state.setModelInfo(null);
            state.setModelReady(false);
          }
        }
      } catch {
        if (!cancelled) state.setModelReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate, setGpu]);

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-1">
          <span className="flex size-8 items-center justify-center rounded-md bg-elevated">
            <Flame className="size-4 text-accent" />
          </span>
          <div>
            <p className="font-medium tracking-tight">Kiln</p>
            <p className="text-micro text-muted-foreground">text → image</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150",
                  active
                    ? "bg-elevated text-foreground"
                    : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 px-1 font-mono text-micro text-muted-foreground">
          <p>{images.length} beelden</p>
          <p>
            {modelReady && modelInfo
              ? modelStale
                ? "model verouderd"
                : "model klaar"
              : "geen model"}
          </p>
          <p className="truncate">{gpu?.backend ?? "device…"}</p>
          {status === "running" || status === "loading" || status === "paused" ? <p>{jobId}</p> : null}
          {compute.device === "cpu" ? <p>cpu</p> : compute.mode !== "local" ? <p>remote-gpu</p> : <p>gpu</p>}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-accent" />
            <span className="text-sm font-medium">Kiln</span>
          </div>
          <nav className="flex gap-1">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-md",
                    active ? "bg-elevated text-foreground" : "text-muted-foreground",
                  )}
                  aria-label={item.label}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8">{ready ? children : null}</main>
      </div>
    </div>
  );
}
