export type ImageRecord = {
  id: string;
  caption: string;
  name: string;
  createdAt: number;
};

export type ComputeMode = "local" | "node" | "remote";

export type ComputeSettings = {
  mode: ComputeMode;
  remoteUrl: string;
  remoteToken: string;
};

export const IMAGE_SIZES = [32, 64, 128, 512] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const BATCH_SIZES = [4, 8, 16, 32, 64] as const;

export type TrainConfig = {
  epochs: number;
  batchSize: number;
  learningRate: number;
  imageSize: ImageSize;
  timesteps: number;
};

export type EpochLog = {
  epoch: number;
  loss: number;
  seconds: number;
};

export type TrainStatus = "idle" | "loading" | "running" | "done" | "error";

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
  backend: string;
  epochs: number;
  sampleCount: number;
  compute: ComputeMode;
};

export type WeightDump = {
  shapes: number[][];
  dataB64: string[];
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

export function clampTrainConfig(config: TrainConfig): TrainConfig {
  const imageSize = asImageSize(Number(config.imageSize));
  const cap = maxBatchFor(imageSize);
  const batchSize = Math.min(Math.max(1, Math.round(Number(config.batchSize) || 8)), cap);
  return {
    ...config,
    imageSize,
    batchSize,
    epochs: Math.min(80, Math.max(4, Math.round(Number(config.epochs) || 40))),
    timesteps: Math.min(80, Math.max(8, Math.round(Number(config.timesteps) || 20))),
    learningRate: Number(config.learningRate) || 0.001,
  };
}

export const DEFAULT_TRAIN_CONFIG: TrainConfig = {
  epochs: 40,
  batchSize: 8,
  learningRate: 0.001,
  imageSize: 32,
  timesteps: 20,
};

export const DEFAULT_COMPUTE: ComputeSettings = {
  mode: "local",
  remoteUrl: "",
  remoteToken: "",
};
