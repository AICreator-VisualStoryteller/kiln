import { FRUIT_MANIFEST } from "@/lib/ml/fruit-manifest";

export const FRUIT_LEGEND = [
  { code: "A", name: "Appels" },
  { code: "AB", name: "Appels met blad" },
  { code: "G", name: "Blauwe appels" },
  { code: "GB", name: "Blauwe appels met blad" },
  { code: "S", name: "Sinaasappels" },
  { code: "SB", name: "Sinaasappels met blad" },
  { code: "P", name: "Peren" },
  { code: "PB", name: "Peren met blad" },
  { code: "C", name: "Citroenen" },
  { code: "CB", name: "Citroenen met blad" },
] as const;

export const FRUIT_CODES = FRUIT_LEGEND.map((g) => g.code);
export const FRUIT_PROMPTS = [...FRUIT_CODES];
export const FRUIT_TOTAL = FRUIT_MANIFEST.items.length;

const CODE_SET = new Set(FRUIT_CODES.map((c) => c.toUpperCase()));

export function isFruitCode(caption: string): boolean {
  return CODE_SET.has(caption.trim().toUpperCase());
}

export type FruitSample = { blob: Blob; name: string; caption: string };

function decodePack(buffer: ArrayBuffer): FruitSample[] {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!);
  if (magic !== "KFR1") throw new Error("Fruitpack ongeldig");
  let o = 4;
  const count = dv.getUint16(o, true);
  o += 2;
  if (count < 1 || count > 500) throw new Error("Fruitpack ongeldig");
  const td = new TextDecoder();
  const out: FruitSample[] = [];
  for (let i = 0; i < count; i++) {
    const labelLen = u8[o++]!;
    const fileLen = u8[o++]!;
    const groupLen = u8[o++]!;
    const label = td.decode(u8.subarray(o, o + labelLen));
    o += labelLen;
    const file = td.decode(u8.subarray(o, o + fileLen));
    o += fileLen;
    o += groupLen;
    const size = dv.getUint32(o, true);
    o += 4;
    if (size < 32 || o + size > u8.length) throw new Error("Fruitpack afgekapt");
    const jpeg = u8.subarray(o, o + size);
    o += size;
    if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) continue;
    out.push({
      blob: new Blob([jpeg], { type: "image/jpeg" }),
      name: file.replaceAll("/", "-"),
      caption: label,
    });
  }
  return out;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

async function packUrls(): Promise<string[]> {
  const urls: string[] = [];
  try {
    const mod = await import("@/assets/fruit-pack.bin?url");
    const asset = (mod as { default?: string }).default;
    if (asset) urls.push(asset);
  } catch {
    /* asset import unavailable during some SSR paths */
  }
  const base = import.meta.env.BASE_URL || "/";
  const rooted = `${base.endsWith("/") ? base : `${base}/`}datasets/fruit-pack.bin`;
  urls.push(rooted, "/datasets/fruit-pack.bin", "/api/fruit-pack");
  return uniqueUrls(urls);
}

async function fetchPack(signal?: AbortSignal): Promise<FruitSample[] | null> {
  for (const url of await packUrls()) {
    try {
      const res = await fetch(url, { signal, cache: "force-cache" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1024) continue;
      const samples = decodePack(buf);
      if (samples.length >= 10) return samples;
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }
  return null;
}

async function fetchLoose(
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<FruitSample[]> {
  const items = FRUIT_MANIFEST.items;
  const packed: FruitSample[] = [];
  const base = import.meta.env.BASE_URL || "/";
  const prefix = `${base.endsWith("/") ? base : `${base}/`}datasets/fruit/`;

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) throw new Error("Gestopt");
    const item = items[i]!;
    const candidates = uniqueUrls([
      `${prefix}${item.file}`,
      `/datasets/fruit/${item.file}`,
    ]);
    for (const url of candidates) {
      try {
        const res = await fetch(url, { signal, cache: "force-cache" });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (blob.size < 64) continue;
        packed.push({
          blob: blob.type ? blob : new Blob([blob], { type: "image/jpeg" }),
          name: item.file.replaceAll("/", "-"),
          caption: item.label,
        });
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }
    onProgress(packed.length, items.length);
  }
  return packed;
}

export async function loadFruitDataset(opts: {
  onProgress: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<FruitSample[]> {
  const total = FRUIT_TOTAL;
  if (total < 100) throw new Error("Fruitdataset is onvolledig");
  opts.onProgress(0, total);

  const packed = await fetchPack(opts.signal);
  if (packed && packed.length) {
    opts.onProgress(packed.length, packed.length);
    return packed;
  }

  const loose = await fetchLoose(opts.onProgress, opts.signal);
  if (!loose.length) {
    throw new Error("Fruitfoto’s konden niet worden geladen. Probeer het opnieuw.");
  }
  return loose;
}
