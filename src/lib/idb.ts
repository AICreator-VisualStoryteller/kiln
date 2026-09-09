import type { ComputeSettings, ImageRecord, ModelInfo, TrainConfig } from "./types";
import { clampTrainConfig, DEFAULT_COMPUTE, DEFAULT_TRAIN_CONFIG } from "./types";

const DB_NAME = "kiln";
const DB_VERSION = 2;

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

export async function loadAll(): Promise<{
  images: ImageRecord[];
  blobs: Record<string, Blob>;
  config: TrainConfig;
  compute: ComputeSettings;
  modelInfo: ModelInfo | null;
}> {
  const db = await openDb();
  const tx = db.transaction(["images", "blobs", "meta"], "readonly");
  const imagesStore = tx.objectStore("images");
  const blobsStore = tx.objectStore("blobs");
  const metaStore = tx.objectStore("meta");

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
  const modelInfo =
    (await reqToPromise<ModelInfo | null | undefined>(metaStore.get("modelInfo"))) ??
    null;

  await txDone(tx);
  return {
    images: (rawImages ?? []).map(asImage),
    blobs,
    config: clampTrainConfig({
      ...DEFAULT_TRAIN_CONFIG,
      ...config,
    }),
    compute: { ...DEFAULT_COMPUTE, ...compute },
    modelInfo,
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
