export function parseLabels(caption: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of caption.split(/[,;\n]+/)) {
    const t = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function joinLabels(labels: string[]): string {
  return parseLabels(labels.join(", ")).join(", ");
}
