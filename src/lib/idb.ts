import type {
  ComputeSettings,
  GalleryRecord,
  ImageRecord,
  ModelInfo,
  TrainConfig,
  WeightDump,
} from "./types";
import { clampCompute, clampTrainConfig, DEFAULT_COMPUTE, DEFAULT_TRAIN_CONFIG } from "./types";

const DB_NAME = "kiln";
const DB_VERSION = 3;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("gallery")) {
        db.createObjectStore("gallery", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function asImage(raw: ImageRecord & { labelId?: string; caption?: string }): ImageRecord {
  return {
    id: raw.id,
    caption: typeof raw.caption === "string" ? raw.caption : "",
    name: raw.name,
    createdAt: raw.createdAt,
  };
}

function asModelInfo(raw: ModelInfo | null | undefined): ModelInfo | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    firstLoss: Number(raw.firstLoss) || Number(raw.finalLoss) || 0,
    weightHash: typeof raw.weightHash === "string" ? raw.weightHash : "",
    updates: Number(raw.updates) || 0,
    arch: raw.arch === "gan" ? "gan" : "diffusion",
  };
}

function asWeights(raw: WeightDump | null | undefined): WeightDump | null {
  if (!raw || !Array.isArray(raw.shapes) || !Array.isArray(raw.dataB64)) return null;
  if (raw.shapes.length === 0 || raw.shapes.length !== raw.dataB64.length) return null;
  return raw;
}

export async function loadAll(): Promise<{
  images: ImageRecord[];
  blobs: Record<string, Blob>;
  config: TrainConfig;
  compute: ComputeSettings;
  modelInfo: ModelInfo | null;
  weights: WeightDump | null;
  gallery: GalleryRecord[];
}> {
  const db = await openDb();
  const tx = db.transaction(["images", "blobs", "meta", "gallery"], "readonly");
  const imagesStore = tx.objectStore("images");
  const blobsStore = tx.objectStore("blobs");
  const metaStore = tx.objectStore("meta");
  const galleryStore = tx.objectStore("gallery");

  const rawImages = await reqToPromise<ImageRecord[]>(imagesStore.getAll());
  const blobKeys = await reqToPromise<IDBValidKey[]>(blobsStore.getAllKeys());
  const blobs: Record<string, Blob> = {};
  for (const key of blobKeys) {
    const blob = await reqToPromise<Blob | undefined>(blobsStore.get(key));
    if (blob) blobs[String(key)] = blob;
  }
  const config =
    (await reqToPromise<TrainConfig | undefined>(metaStore.get("config"))) ??
    DEFAULT_TRAIN_CONFIG;
  const compute =
    (await reqToPromise<ComputeSettings | undefined>(metaStore.get("compute"))) ??
    DEFAULT_COMPUTE;
  const modelInfo = asModelInfo(
    await reqToPromise<ModelInfo | null | undefined>(metaStore.get("modelInfo")),
  );
  const weights = asWeights(
    await reqToPromise<WeightDump | null | undefined>(metaStore.get("weights")),
  );
  const galleryRaw = await reqToPromise<GalleryRecord[]>(galleryStore.getAll());

  await txDone(tx);
  return {
    images: (rawImages ?? []).map(asImage),
    blobs,
    config: clampTrainConfig({
      ...DEFAULT_TRAIN_CONFIG,
      ...config,
    }),
    compute: clampCompute({ ...DEFAULT_COMPUTE, ...compute }),
    modelInfo,
    weights,
    gallery: (galleryRaw ?? [])
      .filter((g) => g && asWeights(g.weights) && asModelInfo(g.info))
      .map((g) => ({
        ...g,
        info: asModelInfo(g.info)!,
        weights: asWeights(g.weights)!,
        arch: (g.arch === "gan" ? "gan" : "diffusion") as "gan" | "diffusion",
        name: typeof g.name === "string" && g.name.trim() ? g.name : "Naamloos model",
        preview: g.preview instanceof Blob ? g.preview : null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
  };
}

export async function saveConfig(config: TrainConfig): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(config, "config");
  await txDone(tx);
}

export async function saveCompute(compute: ComputeSettings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(compute, "compute");
  await txDone(tx);
}

export async function saveModelInfo(info: ModelInfo | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(info, "modelInfo");
  await txDone(tx);
}

export async function saveWeights(dump: WeightDump | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(dump, "weights");
  await txDone(tx);
}

export async function putImages(
  items: { record: ImageRecord; blob: Blob }[],
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["images", "blobs"], "readwrite");
  const images = tx.objectStore("images");
  const blobs = tx.objectStore("blobs");
  for (const item of items) {
    images.put(item.record);
    blobs.put(item.blob, item.record.id);
  }
  await txDone(tx);
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["images", "blobs"], "readwrite");
  tx.objectStore("images").delete(id);
  tx.objectStore("blobs").delete(id);
  await txDone(tx);
}

export async function updateImage(record: ImageRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").put(record);
  await txDone(tx);
}

export async function saveGallery(record: GalleryRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("gallery", "readwrite");
  tx.objectStore("gallery").put(record);
  await txDone(tx);
}

export async function deleteGallery(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("gallery", "readwrite");
  tx.objectStore("gallery").delete(id);
  await txDone(tx);
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["images", "blobs", "meta"], "readwrite");
  tx.objectStore("images").clear();
  tx.objectStore("blobs").clear();
  tx.objectStore("meta").clear();
  await txDone(tx);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
