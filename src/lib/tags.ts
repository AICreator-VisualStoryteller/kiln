const FRUIT_CODES = new Set(["a", "ab", "g", "gb", "s", "sb", "p", "pb", "c", "cb"]);

export function parseLabels(caption: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of caption.split(/[,;\n]+/)) {
    const raw = part.trim().replace(/\s+/g, " ");
    if (!raw) continue;
    const t = FRUIT_CODES.has(raw.toLowerCase()) ? raw.toUpperCase() : raw.toLowerCase();
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function joinLabels(labels: string[]): string {
  return parseLabels(labels.join(", ")).join(", ");
}
