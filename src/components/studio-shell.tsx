import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Flame, Images, LineChart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKiln } from "@/lib/store";
import { loadSavedModel, probeGpu, setMeta } from "@/lib/ml/diffusion";

const NAV = [
  { to: "/", label: "Data", icon: Images },
  { to: "/train", label: "Trainen", icon: LineChart },
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
  const status = useKiln((s) => s.status);
  const jobId = useKiln((s) => s.jobId);
  const compute = useKiln((s) => s.compute);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrate();
      if (cancelled) return;
      try {
        const info = await probeGpu();
        if (!cancelled) setGpu(info);
      } catch {
        if (!cancelled)
          setGpu({ backend: "cpu", renderer: "niet beschikbaar", numTensors: 0, numBytes: 0 });
      }
      const state = useKiln.getState();
      if (state.modelInfo) {
        const ok = await loadSavedModel(state.modelInfo.imageSize, state.modelInfo.timesteps);
        if (ok) setMeta(state.modelInfo.imageSize, state.modelInfo.timesteps);
        else if (!cancelled) {
          await state.setModelInfo(null);
        }
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
        <div className="space-y-3 rounded-lg bg-elevated p-3">
          <Stat label="Beelden" value={String(images.length)} />
          <Stat
            label="Model"
            value={!modelInfo ? "leeg" : modelStale ? "verouderd" : "DDPM"}
          />
          <Stat label="Compute" value={compute.mode} live={status === "running"} />
          <Stat label="GPU" value={gpu?.backend ?? "…"} />
          {jobId ? <Stat label="Job" value={jobId} /> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
          <p className="truncate text-sm text-muted-foreground">
            {gpu?.renderer ? gpu.renderer : "GPU-node detecteren…"}
          </p>
          <p className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:block">
            {status === "running" || status === "loading"
              ? "training"
              : ready
                ? "klaar"
                : "laden"}
          </p>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Stat({
  label,
  value,
  live,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-micro text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-micro tabular-nums text-foreground",
          live && "gpu-live text-accent",
        )}
      >
        {value}
      </span>
    </div>
  );
}
