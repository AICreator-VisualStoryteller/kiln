import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { joinLabels, parseLabels } from "@/lib/tags";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder = "label, dan Enter",
  disabled,
}: {
  value: string;
  onChange: (caption: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const labels = parseLabels(value);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = joinLabels([...labels, raw]);
    onChange(next);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(joinLabels(labels.filter((l) => l !== tag)));
  }

  return (
    <div className="space-y-2">
      {labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {labels.map((tag) => (
            <li
              key={tag}
              className="flex h-8 items-center gap-1 rounded-full bg-elevated px-2.5 text-xs"
            >
              {tag}
              <button
                type="button"
                disabled={disabled}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => remove(tag)}
                aria-label={`${tag} verwijderen`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",") || v.includes(";")) {
            commit(v);
            return;
          }
          setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) commit(draft);
          } else if (e.key === "Backspace" && !draft && labels.length) {
            remove(labels[labels.length - 1]!);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        className={cn("h-10")}
      />
    </div>
  );
}
