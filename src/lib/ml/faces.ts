export const FACE_TOTAL = 320;

export const FACE_PROMPTS = [
  "woman portrait",
  "man portrait",
  "face portrait",
  "person portrait",
  "older gray hair",
  "black man portrait",
  "south asian portrait",
  "man with dark beard",
  "young woman long dark hair",
  "woman curly dark hair",
];

export function isFaceCaption(caption: string): boolean {
  const t = caption.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes("portrait") ||
    t.includes("face") ||
    t.includes("beard") ||
    t.includes("mustache") ||
    /\b(man|woman|person)\b/.test(t)
  );
}

export type FaceSample = { blob: Blob; name: string; caption: string };

function decodePack(buffer: ArrayBuffer): FaceSample[] {
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!);
  if (magic !== "KFR1") throw new Error("Gezichtenpack ongeldig");
  let o = 4;
  const count = dv.getUint16(o, true);
  o += 2;
  if (count < 1 || count > 800) throw new Error("Gezichtenpack ongeldig");
  const td = new TextDecoder();
  const out: FaceSample[] = [];
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
    if (size < 32 || o + size > u8.length) throw new Error("Gezichtenpack afgekapt");
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
    const mod = await import("@/assets/faces-pack.bin?url");
    const asset = (mod as { default?: string }).default;
    if (asset) urls.push(asset);
  } catch {
    /* SSR */
  }
  const base = import.meta.env.BASE_URL || "/";
  const rooted = `${base.endsWith("/") ? base : `${base}/`}datasets/faces-pack.bin`;
  urls.push(rooted, "/datasets/faces-pack.bin", "/api/faces-pack");
  return uniqueUrls(urls);
}

export async function loadFaceDataset(opts: {
  onProgress: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<FaceSample[]> {
  opts.onProgress(0, FACE_TOTAL);
  for (const url of await packUrls()) {
    try {
      const res = await fetch(url, { signal: opts.signal, cache: "force-cache" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1024) continue;
      const samples = decodePack(buf);
      if (samples.length >= 10) {
        opts.onProgress(samples.length, samples.length);
        return samples;
      }
    } catch (err) {
      if (opts.signal?.aborted) throw err;
    }
  }
  throw new Error("Gezichten konden niet worden geladen. Probeer het opnieuw.");
}
