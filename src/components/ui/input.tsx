import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md bg-elevated px-3 text-sm text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_12%,transparent)] outline-none transition-[box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_2px_var(--color-ring)] disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
