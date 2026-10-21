export type ImageRecord = {
  id: string;
  caption: string;
  name: string;
  createdAt: number;
};

export type ComputeMode = "local" | "node" | "remote";
export type TrainDevice = "cpu" | "gpu";

export type ComputeSettings = {
  mode: ComputeMode;
  device: TrainDevice;
  remoteUrl: string;
  remoteToken: string;
};

export const IMAGE_SIZES = [32, 64, 128, 512] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const BATCH_SIZES = [4, 8, 16, 32, 64] as const;
export const EPOCH_PRESETS = [4, 8, 16, 32, 64] as const;

export type ModelArch = "diffusion" | "gan";

export type TrainConfig = {
  epochs: number;
  batchSize: number;
  learningRate: number;
  imageSize: ImageSize;
  timesteps: number;
  arch: ModelArch;
  modelName: string;
};

export type EpochLog = {
  epoch: number;
  loss: number;
  seconds: number;
};

export type TrainStatus = "idle" | "loading" | "running" | "paused" | "done" | "error";

export type GpuInfo = {
  backend: string;
  renderer: string;
  numTensors: number;
  numBytes: number;
};

export type ModelInfo = {
  params: number;
  layers: { name: string; params: number }[];
  imageSize: number;
  timesteps: number;
  trainedAt: number;
  finalLoss: number;
  firstLoss: number;
  backend: string;
  epochs: number;
  sampleCount: number;
  compute: ComputeMode;
  weightHash: string;
  updates: number;
  arch: ModelArch;
  /** True while the run was stopped or paused before all epochs. */
  partial?: boolean;
  epochsDone?: number;
};

export type WeightDump = {
  shapes: number[][];
  dataB64: string[];
};

export type ProofShot = {
  prompt: string;
  url: string;
};

export type GenResult = {
  id: string;
  prompt: string;
  url: string;
  steps: number;
  createdAt: number;
};

export function maxBatchFor(size: number): number {
  if (size >= 512) return 4;
  if (size >= 128) return 16;
  if (size >= 64) return 32;
  return 64;
}

export function asImageSize(n: number): ImageSize {
  if (n === 64 || n === 128 || n === 512) return n;
  return 32;
}

function clampLr(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0.001;
  return Math.min(0.1, Math.max(0.000001, n));
}

export type GalleryRecord = {
  id: string;
  name: string;
  createdAt: number;
  arch: ModelArch;
  info: ModelInfo;
  weights: WeightDump;
  preview: Blob | null;
};

export function clampTrainConfig(config: TrainConfig): TrainConfig {
  const imageSize = asImageSize(Number(config.imageSize));
  const cap = maxBatchFor(imageSize);
  const batchSize = Math.min(Math.max(1, Math.round(Number(config.batchSize) || 8)), cap);
  const arch: ModelArch = config.arch === "gan" ? "gan" : "diffusion";
  return {
    ...config,
    imageSize,
    batchSize,
    arch,
    modelName: typeof config.modelName === "string" ? config.modelName.slice(0, 80) : "",
    epochs: Math.min(64, Math.max(1, Math.round(Number(config.epochs) || 16))),
    timesteps: Math.min(80, Math.max(8, Math.round(Number(config.timesteps) || 20))),
    learningRate: clampLr(Number(config.learningRate)),
  };
}

export const DEFAULT_TRAIN_CONFIG: TrainConfig = {
  epochs: 16,
  batchSize: 8,
  learningRate: 0.001,
  imageSize: 32,
  timesteps: 20,
  arch: "diffusion",
  modelName: "",
};

export const DEFAULT_COMPUTE: ComputeSettings = {
  mode: "local",
  device: "gpu",
  remoteUrl: "",
  remoteToken: "",
};

export function clampCompute(raw: Partial<ComputeSettings> | null | undefined): ComputeSettings {
  const device: TrainDevice = raw?.device === "cpu" ? "cpu" : "gpu";
  let mode: ComputeMode =
    raw?.mode === "remote" || raw?.mode === "node" || raw?.mode === "local" ? raw.mode : "local";
  if (device === "cpu") mode = "local";
  return {
    mode,
    device,
    remoteUrl: typeof raw?.remoteUrl === "string" ? raw.remoteUrl : "",
    remoteToken: typeof raw?.remoteToken === "string" ? raw.remoteToken : "",
  };
}
