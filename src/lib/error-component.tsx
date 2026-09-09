import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-medium">Er ging iets mis</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">
        {error.message || "Onverwachte fout. Probeer de pagina te herladen."}
      </p>
    </main>
  );
}
