import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "bg-elevated text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_12%,transparent)]",
          title: "text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
