import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useKiln } from "@/lib/store";
import { activateGalleryModel } from "@/lib/ml/job";

export function GalleryView() {
  const ready = useKiln((s) => s.ready);
  const gallery = useKiln((s) => s.gallery);
  const activeId = useKiln((s) => s.activeGalleryId);
  const renameGallery = useKiln((s) => s.renameGallery);
  const removeGallery = useKiln((s) => s.removeGallery);
  const status = useKiln((s) => s.status);
  const busy = status === "running" || status === "loading" || status === "paused";
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Galerij laden…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Galerij</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Elk model dat je hier traint wordt automatisch bewaard. Geef het een
            naam, laad het terug, of verwijder het. De dataset wissen laat deze
            galerij staan.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/train">Nieuw model trainen</Link>
        </Button>
      </div>

      {gallery.length === 0 ? (
        <div className="rounded-xl bg-surface px-6 py-10 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <h2 className="text-base font-medium">Nog geen modellen</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rond een training af. Diffusion en GAN verschijnen hier vanzelf.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((item) => {
            const active = item.id === activeId;
            const draft = drafts[item.id] ?? item.name;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]"
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="aspect-square w-full rounded-md bg-elevated object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-md bg-elevated text-xs text-muted-foreground">
                    geen preview
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.arch === "gan" ? "accent" : "muted"}>
                    {item.arch === "gan" ? "GAN" : "Diffusion"}
                  </Badge>
                  {active ? <Badge variant="success">actief</Badge> : null}
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.info.imageSize}px · loss {item.info.finalLoss.toFixed(3)}
                  </span>
                </div>
                <Input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  onBlur={() => {
                    if (draft.trim() && draft.trim() !== item.name) {
                      void renameGallery(item.id, draft);
                    }
                  }}
                  aria-label="Modelnaam"
                />
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("nl-NL")} · {item.info.epochs} epochs ·{" "}
                  {item.info.sampleCount} beelden
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void activateGalleryModel(item.id)
                        .then(() => toast.success(`${item.name} geladen`))
                        .catch((err) =>
                          toast.error(err instanceof Error ? err.message : "Laden mislukt"),
                        );
                    }}
                  >
                    <Sparkles className="size-4" />
                    Laden
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/lab">Genereren</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      void removeGallery(item.id);
                      toast.success("Model verwijderd");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
