import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Images, PawPrint, Pencil, Trash2, Upload, Shapes, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CameraDialog } from "@/components/camera-dialog";
import { SketchDialog } from "@/components/sketch-dialog";
import { TagInput } from "@/components/tag-input";
import { Progress } from "@/components/ui/progress";
import { useKiln } from "@/lib/store";
import { fileToStoredBlob } from "@/lib/image";
import { generateSampleSet } from "@/lib/ml/sample";
import { loadPetDataset } from "@/lib/ml/pets";
import { trainReadiness } from "@/lib/ml/job";
import { parseLabels } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function DatasetView() {
  const images = useKiln((s) => s.images);
  const addImages = useKiln((s) => s.addImages);
  const setImageCaption = useKiln((s) => s.setImageCaption);
  const removeImage = useKiln((s) => s.removeImage);
  const resetAll = useKiln((s) => s.resetAll);
  const ready = useKiln((s) => s.ready);
  const modelInfo = useKiln((s) => s.modelInfo);

  const [camOpen, setCamOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [petProgress, setPetProgress] = useState<{ done: number; total: number } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name),
      );
      if (!files.length) {
        toast.error("Geen afbeeldingen gevonden");
        return;
      }
      const cap = caption.trim();
      setBusy(true);
      try {
        const packed = [];
        for (const file of files) {
          const blob = await fileToStoredBlob(file);
          packed.push({ blob, name: file.name, caption: cap });
        }
        await addImages(packed);
        toast.success(
          cap
            ? `${packed.length} beeld${packed.length === 1 ? "" : "en"} · ${parseLabels(cap).length} labels`
            : `${packed.length} beeld${packed.length === 1 ? "" : "en"} — voeg nog labels toe`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload mislukt");
      } finally {
        setBusy(false);
      }
    },
    [addImages, caption],
  );

  async function onSample() {
    setBusy(true);
    try {
      const samples = await generateSampleSet();
      await addImages(
        samples.map((s) => ({ blob: s.blob, name: s.name, caption: s.caption })),
      );
      toast.success(`${samples.length} captioned vormen geladen`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voorbeeld laden mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onPets() {
    setBusy(true);
    setPetProgress({ done: 0, total: 300 });
    try {
      const samples = await loadPetDataset({
        onProgress: (done, total) => setPetProgress({ done, total }),
      });
      await addImages(samples);
      toast.success(`${samples.length} honden- en kattenfoto’s met multi-labels`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dataset laden mislukt");
    } finally {
      setBusy(false);
      setPetProgress(null);
    }
  }

  const check = trainReadiness();
  const unlabeled = images.filter((im) => !im.caption.trim()).length;

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Dataset laden…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Dataset</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Foto’s uit je galerij, camera of een kant-en-klare set. Elke afbeelding
            krijgt meerdere labels — daarop traint het diffusion-model.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void onSample()} disabled={busy}>
            <Shapes className="size-4" />
            Vormen
          </Button>
          <Button variant="secondary" onClick={() => void onPets()} disabled={busy}>
            <PawPrint className="size-4" />
            Honden & katten
          </Button>
        </div>
      </div>

      {petProgress ? (
        <div className="space-y-2 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <p className="text-sm">
            Foto’s laden… {petProgress.done}/{petProgress.total}
          </p>
          <Progress
            value={petProgress.total ? Math.round((petProgress.done / petProgress.total) * 100) : 0}
          />
        </div>
      ) : null}

      {check.ok && !modelInfo ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{check.n} gelabelde beelden — klaar om te trainen.</p>
          <Button asChild>
            <Link to="/train">
              <Zap className="size-4" />
              Start training
            </Link>
          </Button>
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void ingest(e.dataTransfer.files);
        }}
        className={cn(
          "lab-grid flex min-h-44 flex-col items-center justify-center rounded-xl bg-surface px-6 py-10 text-center",
          "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
          drag && "shadow-[0_0_0_1px_var(--color-accent)]",
        )}
      >
        <Upload className="mb-3 size-5 text-muted-foreground" />
        <p className="text-sm">Sleep foto’s hierheen of kies uit je galerij</p>
        <div className="mx-auto mt-4 w-full max-w-md text-left">
          <p className="mb-1.5 text-xs text-muted-foreground">Labels voor nieuwe foto’s</p>
          <TagInput
            value={caption}
            onChange={setCaption}
            placeholder="hond, golden retriever, buiten"
            disabled={busy}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button disabled={busy} onClick={() => galleryRef.current?.click()}>
            <Images className="size-4" />
            Galerij
          </Button>
          <Button variant="secondary" onClick={() => setCamOpen(true)} disabled={busy}>
            <Camera className="size-4" />
            Camera
          </Button>
          <Button variant="secondary" onClick={() => setSketchOpen(true)} disabled={busy}>
            <Pencil className="size-4" />
            Tekenen
          </Button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void ingest(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <h2 className="text-base font-medium">Vormen</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Gekleurde cirkels, vierkanten en driehoeken met Nederlandse bijschriften.
              Snel om het netwerk te testen.
            </p>
            <Button className="mt-5" onClick={() => void onSample()} disabled={busy}>
              <Shapes className="size-4" />
              Laden
            </Button>
          </div>
          <div className="rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <h2 className="text-base font-medium">Honden & katten</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ongeveer 300 echte foto’s van internet. Elke foto heeft meerdere labels
              (soort, ras, extra tags).
            </p>
            <Button className="mt-5" onClick={() => void onPets()} disabled={busy}>
              <PawPrint className="size-4" />
              300 foto’s laden
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {images.length} beelden
              {unlabeled ? ` · ${unlabeled} zonder labels` : ""} · multi-labels = trainingsconditie
            </p>
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
              <Trash2 className="size-3.5" />
              Wissen
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((im) => (
              <li key={im.id} className="rounded-lg bg-elevated p-2.5">
                <img
                  src={im.url}
                  alt={im.caption || im.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-md object-cover"
                />
                <div className="mt-2">
                  <TagInput
                    value={im.caption}
                    onChange={(v) => void setImageCaption(im.id, v)}
                    placeholder="labels…"
                  />
                </div>
                <button
                  type="button"
                  className="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => void removeImage(im.id)}
                >
                  Verwijderen
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alles wissen?</DialogTitle>
            <DialogDescription>
              Dataset en het getrainde diffusion-model worden verwijderd.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setResetOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                void resetAll();
                setResetOpen(false);
              }}
            >
              Wissen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CameraDialog open={camOpen} onOpenChange={setCamOpen} />
      <SketchDialog open={sketchOpen} onOpenChange={setSketchOpen} />
    </div>
  );
}
