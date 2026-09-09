import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useKiln } from "@/lib/store";
import { cn } from "@/lib/utils";

const SIZE = 256;
const PAPER_DARK = "#1a1b1d";
const PAPER_LIGHT = "#e6e1d8";
const INK_LIGHT = "#ecece8";
const INK_DARK = "#1a1b1d";

function coords(canvas: HTMLCanvasElement, e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

export function SketchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [paperDark, setPaperDark] = useState(true);
  const [stroke, setStroke] = useState(10);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const addImages = useKiln((s) => s.addImages);

  function fillPaper() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = paperDark ? PAPER_DARK : PAPER_LIGHT;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(fillPaper);
    return () => cancelAnimationFrame(id);
  }, [open, paperDark]);

  function paint(e: React.PointerEvent<HTMLCanvasElement>, start: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = coords(canvas, e.nativeEvent);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = paperDark ? INK_LIGHT : INK_DARK;
    ctx.lineWidth = stroke;
    if (start) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }

  async function save() {
    const canvas = canvasRef.current;
    const cap = caption.trim();
    if (!canvas || !cap) {
      toast.error("Vul een bijschrift in");
      return;
    }
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Kon tekening niet opslaan"))),
          "image/png",
        );
      });
      await addImages([{ blob, name: `tekening-${Date.now()}.png`, caption: cap }]);
      toast.success(`Toegevoegd · “${cap}”`);
      fillPaper();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tekenen</DialogTitle>
          <DialogDescription>
            Teken een vorm en geef het een bijschrift. Dat paar gaat de dataset in.
          </DialogDescription>
        </DialogHeader>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="aspect-square w-full touch-none rounded-lg"
          style={{ background: paperDark ? PAPER_DARK : PAPER_LIGHT }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            paint(e, true);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            paint(e, false);
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        />
        <div className="space-y-2">
          <Label htmlFor="sk-cap">Bijschrift</Label>
          <Input
            id="sk-cap"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="een groene driehoek op donkere achtergrond"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="w-16 text-xs text-muted-foreground">Dikte</p>
          <Slider
            min={3}
            max={28}
            step={1}
            value={[stroke]}
            onValueChange={([v]) => setStroke(v ?? 10)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaperDark(true)}
            className={cn(
              "h-9 rounded-md px-3 text-xs",
              paperDark ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground",
            )}
          >
            Donker papier
          </button>
          <button
            type="button"
            onClick={() => setPaperDark(false)}
            className={cn(
              "h-9 rounded-md px-3 text-xs",
              !paperDark ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground",
            )}
          >
            Licht papier
          </button>
          <Button variant="ghost" size="sm" onClick={fillPaper}>
            <Eraser className="size-4" />
            Wissen
          </Button>
        </div>
        <Button onClick={() => void save()} disabled={busy || !caption.trim()} className="w-full">
          <Pencil className="size-4" />
          Toevoegen aan dataset
        </Button>
      </DialogContent>
    </Dialog>
  );
}
