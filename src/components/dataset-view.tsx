import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Apple, Camera, Images, PawPrint, Pencil, ScanFace, Trash2, Upload, Shapes, Zap } from "lucide-react";
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
import { FRUIT_LEGEND, FRUIT_TOTAL, isFruitCode, loadFruitDataset } from "@/lib/ml/fruit";
import { FACE_TOTAL, isFaceCaption, loadFaceDataset } from "@/lib/ml/faces";
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
  const [packProgress, setPackProgress] = useState<{ done: number; total: number } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const fruitCount = images.filter((im) => isFruitCode(im.caption)).length;
  const faceCount = images.filter((im) => isFaceCaption(im.caption)).length;

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
            : `${packed.length} beeld${packed.length === 1 ? "" : "en"} — labels optioneel, klaar om te trainen`,
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
    setPackProgress({ done: 0, total: 300 });
    try {
      const samples = await loadPetDataset({
        onProgress: (done, total) => setPackProgress({ done, total }),
      });
      await addImages(samples);
      toast.success(`${samples.length} honden- en kattenfoto’s met multi-labels`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dataset laden mislukt");
    } finally {
      setBusy(false);
      setPackProgress(null);
    }
  }

  async function onFruit() {
    setBusy(true);
    setPackProgress({ done: 0, total: FRUIT_TOTAL });
    try {
      const samples = await loadFruitDataset({
        onProgress: (done, total) => setPackProgress({ done, total }),
      });
      const chunk = 32;
      for (let i = 0; i < samples.length; i += chunk) {
        await addImages(samples.slice(i, i + chunk));
        setPackProgress({ done: Math.min(samples.length, i + chunk), total: samples.length });
      }
      toast.success(`${samples.length} fruitfoto’s · één label per groep`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fruitdataset laden mislukt");
    } finally {
      setBusy(false);
      setPackProgress(null);
    }
  }

  async function onFaces() {
    setBusy(true);
    setPackProgress({ done: 0, total: FACE_TOTAL });
    try {
      const samples = await loadFaceDataset({
        onProgress: (done, total) => setPackProgress({ done, total }),
      });
      const chunk = 40;
      for (let i = 0; i < samples.length; i += chunk) {
        await addImages(samples.slice(i, i + chunk));
        setPackProgress({ done: Math.min(samples.length, i + chunk), total: samples.length });
      }
      toast.success(`${samples.length} gezichten met korte Engelse labels`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gezichten laden mislukt");
    } finally {
      setBusy(false);
      setPackProgress(null);
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
            Foto’s uit je galerij, camera of een kant-en-klare set. Labels zijn
            optioneel — zonder labels traint het model ongeconditioneerd.
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
          <Button variant="secondary" onClick={() => void onFruit()} disabled={busy}>
            <Apple className="size-4" />
            Fruit
          </Button>
          <Button variant="secondary" onClick={() => void onFaces()} disabled={busy}>
            <ScanFace className="size-4" />
            Gezichten
          </Button>
        </div>
      </div>

      {packProgress ? (
        <div className="space-y-2 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <p className="text-sm">
            Foto’s laden… {packProgress.done}/{packProgress.total}
          </p>
          <Progress
            value={packProgress.total ? Math.round((packProgress.done / packProgress.total) * 100) : 0}
          />
        </div>
      ) : null}

      {check.ok && !modelInfo ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {check.n} beelden{check.labeled ? ` · ${check.labeled} gelabeld` : " zonder labels"} —
            klaar om te trainen.
          </p>
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

      {fruitCount > 0 ? (
        <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <p className="text-sm font-medium">Fruitlabels — één code per groep</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FRUIT_LEGEND.map((g) => (
              <li key={g.code} className="flex items-center gap-2 text-xs">
                <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md bg-elevated px-2 font-mono text-xs">
                  {g.code}
                </span>
                <span className="text-muted-foreground">{g.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
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
          <div className="rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <h2 className="text-base font-medium">Fruit</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              126 echte foto’s. Elke groep één label: A, AB, G, GB, S, SB, P, PB, C, CB.
            </p>
            <Button className="mt-5" onClick={() => void onFruit()} disabled={busy}>
              <Apple className="size-4" />
              126 foto’s laden
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {images.length} beelden
              {unlabeled ? ` · ${unlabeled} zonder labels` : ""}
              {fruitCount ? " · fruitcodes als conditie" : " · labels = trainingsconditie"}
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
