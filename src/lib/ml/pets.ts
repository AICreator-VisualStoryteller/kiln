import { fileToStoredBlob } from "@/lib/image";
import { joinLabels } from "@/lib/tags";

export type PetEntry = {
  url: string;
  name: string;
  labels: string[];
};

const TARGET = 300;

function breedFromDogUrl(url: string): string {
  const m = url.match(/breeds\/([^/]+)\//i);
  return (m?.[1] ?? "hond").replace(/-/g, " ");
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dataset ${res.status}`);
  return (await res.json()) as T;
}

async function listDogs(count: number): Promise<PetEntry[]> {
  const out: PetEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 6 && out.length < count; i++) {
    const body = await json<{ message: string[] | string; status: string }>(
      `https://dog.ceo/api/breeds/image/random/50`,
    );
    const urls = Array.isArray(body.message) ? body.message : [body.message];
    for (const url of urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const breed = breedFromDogUrl(url);
      out.push({
        url,
        name: `${breed.replace(/\s+/g, "-")}-${out.length + 1}.jpg`,
        labels: joinLabels(["hond", breed, "huisdier", "foto"]).split(", "),
      });
      if (out.length >= count) break;
    }
  }
  return out;
}

type CatHit = {
  url?: string;
  breeds?: { name?: string; temperament?: string; origin?: string }[];
};

async function listCats(count: number): Promise<PetEntry[]> {
  const out: PetEntry[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < 20 && out.length < count; page++) {
    const qs = new URLSearchParams({
      limit: "10",
      page: String(page),
      order: "ASC",
      mime_types: "jpg,png",
      size: "med",
    });
    if (page % 2 === 0) qs.set("has_breeds", "1");
    const hits = await json<CatHit[]>(`https://api.thecatapi.com/v1/images/search?${qs}`);
    for (const hit of hits) {
      if (!hit.url || seen.has(hit.url)) continue;
      seen.add(hit.url);
      const breed = hit.breeds?.[0];
      const extra = (breed?.temperament ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      const labels = joinLabels(
        ["kat", breed?.name ?? "", breed?.origin ?? "", ...extra, "huisdier", "foto"],
      ).split(", ");
      out.push({
        url: hit.url,
        name: `${(breed?.name ?? "kat").toLowerCase().replace(/\s+/g, "-")}-${out.length + 1}.jpg`,
        labels,
      });
      if (out.length >= count) break;
    }
  }
  return out;
}

export async function listPetDataset(): Promise<PetEntry[]> {
  const [dogs, cats] = await Promise.all([listDogs(160), listCats(160)]);
  const mixed: PetEntry[] = [];
  const n = Math.max(dogs.length, cats.length);
  for (let i = 0; i < n; i++) {
    if (dogs[i]) mixed.push(dogs[i]!);
    if (cats[i]) mixed.push(cats[i]!);
  }
  return mixed.slice(0, TARGET);
}

function proxyUrl(url: string): string {
  return `/api/media?url=${encodeURIComponent(url)}`;
}

export async function blobFromRemote(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0 && blob.type.startsWith("image")) return blob;
    }
  } catch {
    /* proxy */
  }
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error("foto laden mislukt");
  return res.blob();
}

export async function loadPetDataset(opts: {
  onProgress: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; name: string; caption: string }[]> {
  const entries = await listPetDataset();
  const total = entries.length;
  opts.onProgress(0, total);
  const packed: { blob: Blob; name: string; caption: string }[] = [];
  let cursor = 0;
  const workers = 6;

  async function worker() {
    while (cursor < entries.length) {
      if (opts.signal?.aborted) throw new Error("Gestopt");
      const i = cursor++;
      const entry = entries[i]!;
      try {
        const raw = await blobFromRemote(entry.url);
        const blob = await fileToStoredBlob(raw);
        packed.push({
          blob,
          name: entry.name,
          caption: joinLabels(entry.labels),
        });
      } catch {
        /* skip broken photo */
      }
      opts.onProgress(packed.length, total);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  if (packed.length < 40) {
    throw new Error("Te weinig foto’s geladen. Probeer het opnieuw.");
  }
  return packed;
}
