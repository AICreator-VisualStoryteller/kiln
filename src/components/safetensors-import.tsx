import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { installImportedModel } from "@/lib/ml/job";

export function SafetensorsImport({
  disabled,
  size = "default",
}: {
  disabled?: boolean;
  size?: "default" | "sm";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const info = await installImportedModel(file);
      toast.success(`Model geladen · ${info.imageSize}px · ${info.params.toLocaleString("nl-NL")} params`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import mislukt");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
      >
        <Upload className="size-4" />
        {busy ? "Laden…" : "Importeer .safetensors"}
      </Button>
      <input
        ref={ref}
        type="file"
        accept=".safetensors,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void onPick(file);
        }}
      />
    </>
  );
}
