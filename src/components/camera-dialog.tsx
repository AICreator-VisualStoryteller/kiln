import { useEffect, useRef, useState } from "react";
import { Camera, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fileToStoredBlob } from "@/lib/image";
import { useKiln } from "@/lib/store";

function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const size = Math.min(video.videoWidth, video.videoHeight);
  if (!size) return Promise.reject(new Error("Camera nog niet klaar"));
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas niet beschikbaar"));
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 256, 256);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Frame vastleggen mislukt"))),
      "image/jpeg",
      0.9,
    );
  });
}

export function CameraDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const addImages = useKiln((s) => s.addImages);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLive(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setLive(true);
      } catch {
        if (!cancelled) setError("Geen toegang tot de camera.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  async function capture(count: number) {
    const video = videoRef.current;
    const cap = caption.trim();
    if (!video || !cap) {
      toast.error("Vul een bijschrift in");
      return;
    }
    setBusy(true);
    try {
      const packed: { blob: Blob; name: string; caption: string }[] = [];
      for (let i = 0; i < count; i++) {
        const raw = await grabFrame(video);
        const blob = await fileToStoredBlob(raw);
        packed.push({ blob, name: `cam-${Date.now()}-${i + 1}.jpg`, caption: cap });
        if (count > 1) await new Promise((r) => setTimeout(r, 280));
      }
      await addImages(packed);
      toast.success(`${packed.length} shot${packed.length === 1 ? "" : "s"} · “${cap}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opname mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Camera</DialogTitle>
          <DialogDescription>Shots krijgen de labels hieronder (komma’s).</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg bg-elevated">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cam-cap">Labels</Label>
          <Input
            id="cam-cap"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="hond, buiten, foto"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void capture(1)} disabled={!live || busy || !caption.trim()}>
            <Circle className="size-4" />
            Vastleggen
          </Button>
          <Button
            variant="secondary"
            onClick={() => void capture(6)}
            disabled={!live || busy || !caption.trim()}
          >
            <Camera className="size-4" />
            6 shots
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
