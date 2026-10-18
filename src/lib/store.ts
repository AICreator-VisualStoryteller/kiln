import { create } from "zustand";
import type {
  ComputeSettings,
  EpochLog,
  GalleryRecord,
  GpuInfo,
  ImageRecord,
  ModelInfo,
  ProofShot,
  TrainConfig,
  TrainStatus,
  WeightDump,
} from "./types";
import { DEFAULT_COMPUTE, DEFAULT_TRAIN_CONFIG, clampCompute, clampTrainConfig } from "./types";
import * as idb from "./idb";

export type ImageItem = ImageRecord & { url: string };

export type GalleryItem = GalleryRecord & { previewUrl: string };

type KilnState = {
  ready: boolean;
  images: ImageItem[];
  config: TrainConfig;
  compute: ComputeSettings;
  status: TrainStatus;
  logs: EpochLog[];
  trainMessage: string;
  jobId: string | null;
  consoleLines: string[];
  prepDone: number;
  prepTotal: number;
  gpu: GpuInfo | null;
  modelInfo: ModelInfo | null;
  modelStale: boolean;
  modelReady: boolean;
  weightsDump: WeightDump | null;
  proofs: ProofShot[];
  gallery: GalleryItem[];
  activeGalleryId: string | null;
  hydrate: () => Promise<void>;
  addImages: (files: { blob: Blob; name: string; caption: string }[]) => Promise<void>;
  setImageCaption: (id: string, caption: string) => Promise<void>;
  removeImage: (id: string) => Promise<void>;
  setConfig: (patch: Partial<TrainConfig>) => Promise<void>;
  setCompute: (patch: Partial<ComputeSettings>) => Promise<void>;
  setStatus: (status: TrainStatus) => void;
  setTrainMessage: (msg: string) => void;
  pushLog: (log: EpochLog) => void;
  beginJob: (id: string) => void;
  pushConsole: (line: string) => void;
  setPrep: (done: number, total: number) => void;
  setGpu: (gpu: GpuInfo) => void;
  setModelInfo: (info: ModelInfo | null, stale?: boolean) => Promise<void>;
  setModelReady: (ready: boolean) => void;
  setWeightsDump: (dump: WeightDump | null) => Promise<void>;
  setProofs: (proofs: ProofShot[]) => void;
  publishModel: (record: GalleryRecord) => Promise<void>;
  renameGallery: (id: string, name: string) => Promise<void>;
  removeGallery: (id: string) => Promise<void>;
  setActiveGalleryId: (id: string | null) => void;
  resetAll: () => Promise<void>;
};

function uid() {
  return crypto.randomUUID();
}

function revoke(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

export const useKiln = create<KilnState>((set, get) => ({
  ready: false,
  images: [],
  config: DEFAULT_TRAIN_CONFIG,
  compute: DEFAULT_COMPUTE,
  status: "idle",
  logs: [],
  trainMessage: "",
  jobId: null,
  consoleLines: [],
  prepDone: 0,
  prepTotal: 0,
  gpu: null,
  modelInfo: null,
  modelStale: false,
  modelReady: false,
  weightsDump: null,
  proofs: [],
  gallery: [],
  activeGalleryId: null,

  hydrate: async () => {
    const data = await idb.loadAll();
    const images: ImageItem[] = data.images.map((rec) => ({
      ...rec,
      url: data.blobs[rec.id] ? URL.createObjectURL(data.blobs[rec.id]!) : "",
    }));
    const gallery: GalleryItem[] = data.gallery.map((rec) => ({
      ...rec,
      previewUrl: rec.preview ? URL.createObjectURL(rec.preview) : "",
    }));
    set({
      ready: true,
      images,
      config: data.config,
      compute: data.compute,
      modelInfo: data.modelInfo,
      weightsDump: data.weights,
      modelStale: false,
      modelReady: false,
      gallery,
    });
  },

  addImages: async (files) => {
    const items: ImageItem[] = [];
    const packed: { record: ImageRecord; blob: Blob }[] = [];
    for (const file of files) {
      const record: ImageRecord = {
        id: uid(),
        caption: file.caption,
        name: file.name,
        createdAt: Date.now(),
      };
      packed.push({ record, blob: file.blob });
      items.push({ ...record, url: URL.createObjectURL(file.blob) });
    }
    await idb.putImages(packed);
    set({
      images: [...get().images, ...items],
      modelStale: get().modelInfo !== null,
    });
  },

  setImageCaption: async (id, caption) => {
    const images = get().images.map((im) => (im.id === id ? { ...im, caption } : im));
    const found = images.find((im) => im.id === id);
    if (found) await idb.updateImage(found);
    set({ images, modelStale: get().modelInfo !== null });
  },

  removeImage: async (id) => {
    const found = get().images.find((im) => im.id === id);
    if (found) revoke(found.url);
    await idb.deleteImage(id);
    set({
      images: get().images.filter((im) => im.id !== id),
      modelStale: get().modelInfo !== null,
    });
  },

  setConfig: async (patch) => {
    const config = clampTrainConfig({ ...get().config, ...patch });
    await idb.saveConfig(config);
    set({ config });
  },

  setCompute: async (patch) => {
    const compute = clampCompute({ ...get().compute, ...patch });
    await idb.saveCompute(compute);
    set({ compute });
  },

  setStatus: (status) => set({ status }),
  setTrainMessage: (trainMessage) => set({ trainMessage }),
  pushLog: (log) => set({ logs: [...get().logs, log] }),

  beginJob: (id) => {
    for (const p of get().proofs) revoke(p.url);
    set({
      jobId: id,
      logs: [],
      consoleLines: [`${id}  submitted`],
      prepDone: 0,
      prepTotal: 0,
      trainMessage: "Job starten…",
      status: "loading",
      modelReady: false,
      proofs: [],
    });
  },

  pushConsole: (line) =>
    set({ consoleLines: [...get().consoleLines, line].slice(-80) }),

  setPrep: (done, total) => set({ prepDone: done, prepTotal: total }),
  setGpu: (gpu) => set({ gpu }),

  setModelInfo: async (info, stale = false) => {
    await idb.saveModelInfo(info);
    set({ modelInfo: info, modelStale: stale });
  },

  setModelReady: (modelReady) => set({ modelReady }),

  setWeightsDump: async (dump) => {
    await idb.saveWeights(dump);
    set({ weightsDump: dump });
  },

  setProofs: (proofs) => {
    for (const p of get().proofs) revoke(p.url);
    set({ proofs });
  },

  publishModel: async (record) => {
    await idb.saveGallery(record);
    const previewUrl = record.preview ? URL.createObjectURL(record.preview) : "";
    const item = { ...record, previewUrl };
    const rest = get().gallery.filter((g) => g.id !== record.id);
    for (const old of get().gallery) {
      if (old.id === record.id && old.previewUrl) revoke(old.previewUrl);
    }
    set({ gallery: [item, ...rest], activeGalleryId: record.id });
  },

  renameGallery: async (id, name) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    const found = get().gallery.find((g) => g.id === id);
    if (!found) return;
    const next = { ...found, name: trimmed };
    const { previewUrl: _url, ...record } = next;
    await idb.saveGallery(record);
    set({
      gallery: get().gallery.map((g) => (g.id === id ? { ...g, name: trimmed } : g)),
    });
  },

  removeGallery: async (id) => {
    const found = get().gallery.find((g) => g.id === id);
    if (found?.previewUrl) revoke(found.previewUrl);
    await idb.deleteGallery(id);
    set({
      gallery: get().gallery.filter((g) => g.id !== id),
      activeGalleryId: get().activeGalleryId === id ? null : get().activeGalleryId,
    });
  },

  setActiveGalleryId: (activeGalleryId) => set({ activeGalleryId }),

  resetAll: async () => {
    try {
      const { disposeModel } = await import("./ml/diffusion");
      const { disposeGan } = await import("./ml/gan");
      disposeGan();
      await disposeModel();
    } catch {
      /* ignore */
    }
    for (const im of get().images) revoke(im.url);
    for (const p of get().proofs) revoke(p.url);
    await idb.clearAll();
    set({
      images: [],
      config: DEFAULT_TRAIN_CONFIG,
      compute: DEFAULT_COMPUTE,
      status: "idle",
      logs: [],
      trainMessage: "",
      jobId: null,
      consoleLines: [],
      prepDone: 0,
      prepTotal: 0,
      modelInfo: null,
      modelStale: false,
      modelReady: false,
      weightsDump: null,
      proofs: [],
    });
  },
}));
