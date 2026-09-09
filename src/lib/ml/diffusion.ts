import type { EpochLog, GpuInfo, ModelInfo, TrainConfig, WeightDump } from "../types.ts";
import { b64ToF32, f32ToB64, rgbToImageData, softenRgb } from "./codec.ts";
import { ddimTimesteps, makeSchedule } from "./schedule.ts";
import { bagOfWords, VOCAB_SIZE } from "./text.ts";

type Tf = typeof import("@tensorflow/tfjs");
type LayersModel = import("@tensorflow/tfjs").LayersModel;
type SymbolicTensor = import("@tensorflow/tfjs").SymbolicTensor;
type Tensor = import("@tensorflow/tfjs").Tensor;

const MODEL_KEY = "indexeddb://kiln-ddpm-x0-v2";
const T_EMB = 32;
const COND = 96;
const UNCOND_P = 0.1;

let tfMod: Tf | null = null;
let model: LayersModel | null = null;
let imageSize = 32;
let timesteps = 20;
let abortFlag = false;

function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function asSym(x: unknown): SymbolicTensor {
  return x as SymbolicTensor;
}

export async function getTf(): Promise<Tf> {
  if (tfMod) return tfMod;
  const tf = await import("@tensorflow/tfjs");
  if (typeof window !== "undefined") {
    try {
      const ok = await tf.setBackend("webgl");
      if (!ok) await tf.setBackend("cpu");
    } catch {
      await tf.setBackend("cpu");
    }
  } else {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  tf.enableProdMode();
  tfMod = tf;
  return tf;
}

export function getGpuRenderer(): string {
  if (typeof document === "undefined") return "Node CPU";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "CPU (geen WebGL)";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "WebGL GPU";
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "WebGL GPU");
  } catch {
    return "onbekend";
  }
}

export async function probeGpu(): Promise<GpuInfo> {
  const tf = await getTf();
  const mem = tf.memory();
  return {
    backend: tf.getBackend(),
    renderer: getGpuRenderer(),
    numTensors: mem.numTensors,
    numBytes: mem.numBytes,
  };
}

function conv3(tf: Tf, x: SymbolicTensor, filters: number, name: string): SymbolicTensor {
  const z = asSym(
    tf.layers
      .conv2d({
        filters,
        kernelSize: 3,
        padding: "same",
        kernelInitializer: "heNormal",
        name,
      })
      .apply(x),
  );
  return asSym(tf.layers.leakyReLU({ alpha: 0.2, name: `${name}_act` }).apply(z));
}

function addCond(
  tf: Tf,
  x: SymbolicTensor,
  cond: SymbolicTensor,
  filters: number,
  spatial: number,
  name: string,
): SymbolicTensor {
  const p = asSym(tf.layers.dense({ units: filters, name: `${name}_p` }).apply(cond));
  const r = asSym(tf.layers.reshape({ targetShape: [1, 1, filters], name: `${name}_r` }).apply(p));
  const m = asSym(
    tf.layers
      .upSampling2d({ size: [spatial, spatial], interpolation: "nearest", name: `${name}_u` })
      .apply(r),
  );
  return asSym(tf.layers.add({ name: `${name}_add` }).apply([x, m]));
}

function convBlock(
  tf: Tf,
  x: SymbolicTensor,
  filters: number,
  spatial: number,
  cond: SymbolicTensor,
  name: string,
): SymbolicTensor {
  const a = conv3(tf, x, filters, `${name}_1`);
  const b = conv3(tf, a, filters, `${name}_2`);
  return addCond(tf, b, cond, filters, spatial, name);
}

export function buildUnet(tf: Tf, size: number): LayersModel {
  const noisy = tf.input({ shape: [size, size, 3], name: "x" });
  const tembIn = tf.input({ shape: [T_EMB], name: "t" });
  const bowIn = tf.input({ shape: [VOCAB_SIZE], name: "bow" });
  const condDim = size >= 128 ? 64 : COND;

  const txt = asSym(
    tf.layers.dense({ units: 64, activation: "relu", name: "txt" }).apply(bowIn),
  );
  const cond = asSym(
    tf.layers
      .dense({ units: condDim, activation: "relu", name: "cond" })
      .apply(tf.layers.concatenate({ name: "cond_cat" }).apply([tembIn, txt])),
  );

  const f =
    size >= 512
      ? { a: 8, b: 16, c: 24, d: 32 }
      : size >= 128
        ? { a: 16, b: 24, c: 32, d: 48 }
        : { a: 24, b: 32, c: 48, d: 64 };
  const s2 = size / 2;
  const s4 = size / 4;
  const s8 = size / 8;

  const enc1 = convBlock(tf, noisy, f.a, size, cond, "enc1");
  const p1 = asSym(tf.layers.maxPooling2d({ poolSize: 2, name: "pool1" }).apply(enc1));
  const enc2 = convBlock(tf, p1, f.b, s2, cond, "enc2");
  const p2 = asSym(tf.layers.maxPooling2d({ poolSize: 2, name: "pool2" }).apply(enc2));
  const enc3 = convBlock(tf, p2, f.c, s4, cond, "enc3");
  const p3 = asSym(tf.layers.maxPooling2d({ poolSize: 2, name: "pool3" }).apply(enc3));
  const bot = convBlock(tf, p3, f.d, s8, cond, "bot");

  const u3 = asSym(tf.layers.upSampling2d({ size: [2, 2], name: "up3" }).apply(bot));
  const c3 = asSym(tf.layers.concatenate({ axis: -1, name: "skip3" }).apply([u3, enc3]));
  const dec3 = convBlock(tf, c3, f.c, s4, cond, "dec3");
  const u2 = asSym(tf.layers.upSampling2d({ size: [2, 2], name: "up2" }).apply(dec3));
  const c2 = asSym(tf.layers.concatenate({ axis: -1, name: "skip2" }).apply([u2, enc2]));
  const dec2 = convBlock(tf, c2, f.b, s2, cond, "dec2");
  const u1 = asSym(tf.layers.upSampling2d({ size: [2, 2], name: "up1" }).apply(dec2));
  const c1 = asSym(tf.layers.concatenate({ axis: -1, name: "skip1" }).apply([u1, enc1]));
  const dec1 = convBlock(tf, c1, f.a, size, cond, "dec1");
  const out = asSym(
    tf.layers
      .conv2d({
        filters: 3,
        kernelSize: 1,
        padding: "same",
        activation: "tanh",
        kernelInitializer: "glorotNormal",
        name: "x0",
      })
      .apply(dec1),
  );

  return tf.model({ inputs: [noisy, tembIn, bowIn], outputs: out, name: "kiln_x0" });
}

function countParams(m: LayersModel): ModelInfo["layers"] {
  return m.layers.map((layer) => {
    let params = 0;
    for (const w of layer.getWeights()) params += w.size;
    return { name: layer.name, params };
  });
}

function sinusoidT(tf: Tf, t: Tensor, dim = T_EMB): Tensor {
  const half = dim / 2;
  const freqs = tf.exp(tf.linspace(0, -Math.log(10000), half));
  const args = t.toFloat().expandDims(1).mul(freqs.reshape([1, half]));
  return tf.concat([args.sin(), args.cos()], 1);
}

export type RgbSample = {
  caption: string;
  rgb?: Float32Array;
  load?: () => Promise<Float32Array>;
};

export async function resolveRgb(sample: RgbSample): Promise<Float32Array> {
  if (sample.rgb) return sample.rgb;
  if (!sample.load) throw new Error("sample zonder pixels");
  sample.rgb = await sample.load();
  return sample.rgb;
}

export async function trainDiffusion(opts: {
  samples: RgbSample[];
  config: TrainConfig;
  onEpoch: (log: EpochLog) => void;
  onStatus: (msg: string) => void;
  onBatch?: (done: number, total: number) => void;
}): Promise<{ info: ModelInfo; weights: WeightDump }> {
  abortFlag = false;
  const tf = await getTf();
  const { samples, config } = opts;
  const size = config.imageSize;
  const T = config.timesteps;
  imageSize = size;
  timesteps = T;
  const sched = makeSchedule(T);

  opts.onStatus(`backend ${tf.getBackend()} · x0-U-Net ${size}×${size} · T=${T}`);

  if (model) {
    model.dispose();
    model = null;
  }
  model = buildUnet(tf, size);
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: "meanSquaredError",
  });
  const net = model;

  const n = samples.length;
  const cache = new Map<number, Float32Array>();
  const rgbBytes = size * size * 12;
  const maxCached = Math.max(8, Math.min(n, Math.floor(64_000_000 / rgbBytes)));

  async function rgbAt(i: number): Promise<Float32Array> {
    const hit = cache.get(i);
    if (hit) return hit;
    const rgb = await resolveRgb(samples[i]!);
    if (cache.size >= maxCached) {
      const oldest = cache.keys().next().value as number | undefined;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(i, rgb);
    return rgb;
  }

  const alphaBar = tf.tensor1d(sched.alphaBar);
  const batchSize = Math.min(config.batchSize, n);
  const stepsPerEpoch = Math.ceil(n / batchSize);
  let lastLoss = 0;
  const t0 = performance.now();
  let lastAt = t0;

  try {
    for (let epoch = 0; epoch < config.epochs; epoch++) {
      if (abortFlag) throw new Error("Training gestopt");
      const order = shuffleIndices(n);
      let epochLoss = 0;
      for (let step = 0; step < stepsPerEpoch; step++) {
        if (abortFlag) throw new Error("Training gestopt");
        const start = step * batchSize;
        const end = Math.min(start + batchSize, n);
        const idx = order.slice(start, end);
        const b = idx.length;
        const pix = size * size * 3;
        const xData = new Float32Array(b * pix);
        const bowData = new Float32Array(b * VOCAB_SIZE);
        for (let k = 0; k < b; k++) {
          const rgb = await rgbAt(idx[k]!);
          for (let j = 0; j < pix; j++) xData[k * pix + j] = (rgb[j] ?? 0) * 2 - 1;
          const bow =
            Math.random() < UNCOND_P
              ? new Float32Array(VOCAB_SIZE)
              : bagOfWords(samples[idx[k]!]!.caption);
          bowData.set(bow, k * VOCAB_SIZE);
        }
        const x0 = tf.tensor4d(xData, [b, size, size, 3]);
        const bow = tf.tensor2d(bowData, [b, VOCAB_SIZE]);
        const tFloat =
          Math.random() < 0.6 ? tf.randomUniform([b], T * 0.4, T) : tf.randomUniform([b], 0, T);
        const tInt = tFloat.floor().toInt();
        tFloat.dispose();
        const ab = tf.gather(alphaBar, tInt).reshape([b, 1, 1, 1]);
        const noise = tf.randomNormal(x0.shape as [number, number, number, number]);
        const xt = x0.mul(ab.sqrt()).add(noise.mul(tf.sub(1, ab).sqrt()));
        const tEmb = tf.tidy(() => sinusoidT(tf, tInt));

        const out = await net.trainOnBatch([xt, tEmb, bow], x0);
        const loss = Array.isArray(out) ? Number(out[0]) : Number(out);
        epochLoss += loss;

        x0.dispose();
        bow.dispose();
        tInt.dispose();
        ab.dispose();
        noise.dispose();
        xt.dispose();
        tEmb.dispose();

        opts.onBatch?.(epoch * stepsPerEpoch + step + 1, config.epochs * stepsPerEpoch);
        if (typeof window !== "undefined") await tf.nextFrame();
      }
      lastLoss = epochLoss / stepsPerEpoch;
      const now = performance.now();
      opts.onEpoch({
        epoch: epoch + 1,
        loss: lastLoss,
        seconds: (now - lastAt) / 1000,
      });
      lastAt = now;
    }
  } finally {
    alphaBar.dispose();
    cache.clear();
  }

  if (!model) throw new Error("Model verdween tijdens training");
  const layers = countParams(model);
  const params = layers.reduce((s, l) => s + l.params, 0);
  const info: ModelInfo = {
    params,
    layers,
    imageSize: size,
    timesteps: T,
    trainedAt: Date.now(),
    finalLoss: lastLoss,
    backend: tf.getBackend(),
    epochs: config.epochs,
    sampleCount: n,
    compute: "local",
  };

  opts.onStatus("Gewichten opslaan…");
  const weights = await dumpWeights(model);
  try {
    await model.save(MODEL_KEY);
  } catch {
    /* indexed still works */
  }
  void t0;
  return { info, weights };
}

export function stopTraining(): void {
  abortFlag = true;
}

export async function dumpWeights(m: LayersModel = model!): Promise<WeightDump> {
  if (!m) throw new Error("Geen model");
  const ws = m.getWeights();
  const shapes = ws.map((w) => [...w.shape]);
  const dataB64: string[] = [];
  for (const w of ws) {
    const data = await w.data();
    dataB64.push(f32ToB64(data));
  }
  return { shapes, dataB64 };
}

export async function loadWeights(dump: WeightDump, size: number, T: number): Promise<void> {
  const tf = await getTf();
  if (model) model.dispose();
  model = buildUnet(tf, size);
  imageSize = size;
  timesteps = T;
  const tensors = dump.shapes.map((shape, i) =>
    tf.tensor(b64ToF32(dump.dataB64[i]!), shape),
  );
  model.setWeights(tensors);
  tensors.forEach((t) => t.dispose());
  try {
    await model.save(MODEL_KEY);
  } catch {
    /* indexed still works in-session */
  }
}

export async function loadSavedModel(size: number, T: number): Promise<boolean> {
  const tf = await getTf();
  try {
    const loaded = await tf.loadLayersModel(MODEL_KEY);
    if (model) model.dispose();
    model = loaded;
    imageSize = size;
    timesteps = T;
    return true;
  } catch {
    return false;
  }
}

export function hasModel(): boolean {
  return model !== null;
}

export function setMeta(size: number, T: number) {
  imageSize = size;
  timesteps = T;
}

function predictX0(
  tf: Tf,
  net: LayersModel,
  x: Tensor,
  t: number,
  bow: Tensor,
  guidance: number,
): { x0: Tensor; dispose: () => void } {
  const useCfg = guidance > 1.02;
  const tInt = tf.tensor1d(useCfg ? [t, t] : [t], "int32");
  const tEmb = tf.tidy(() => sinusoidT(tf, tInt));
  const zeros = useCfg ? tf.zeros([1, VOCAB_SIZE]) : null;
  const bowIn = useCfg && zeros ? bow.concat(zeros) : bow;
  const xIn = useCfg ? x.concat(x) : x;
  const pred = net.predict([xIn, tEmb, bowIn]) as Tensor;
  let x0: Tensor;
  if (useCfg) {
    x0 = tf.tidy(() => {
      const parts = tf.split(pred, 2, 0);
      const mixed = parts[1]!.add(parts[0]!.sub(parts[1]!).mul(guidance));
      return mixed.clipByValue(-1, 1);
    });
    pred.dispose();
  } else {
    x0 = pred.clipByValue(-1, 1);
    pred.dispose();
  }
  const extras: Tensor[] = [tInt, tEmb];
  if (zeros) extras.push(zeros);
  if (useCfg && bowIn !== bow) extras.push(bowIn);
  if (useCfg && xIn !== x) extras.push(xIn);
  return {
    x0,
    dispose: () => extras.forEach((tns) => tns.dispose()),
  };
}

export async function sampleDiffusion(opts: {
  prompt: string;
  steps: number;
  seed?: number;
  guidance?: number;
  onStep?: (frame: ImageData, step: number, total: number) => void;
}): Promise<ImageData> {
  if (!model) throw new Error("Nog geen getraind diffusion-model");
  const tf = await getTf();
  const net = model;
  const size = imageSize;
  const T = timesteps;
  const sched = makeSchedule(T);
  const nSteps = Math.max(4, Math.min(opts.steps, T));
  const times = ddimTimesteps(T, nSteps);
  const guidance = opts.guidance ?? 1.4;
  const bow = tf.tensor2d(bagOfWords(opts.prompt), [1, VOCAB_SIZE]);

  let x: Tensor = tf.randomNormal([1, size, size, 3]);
  const total = times.length + 1;
  try {
    for (let i = 0; i < times.length; i++) {
      const t = times[i]!;
      const tPrev = i + 1 < times.length ? times[i + 1]! : -1;
      const pred = predictX0(tf, net, x, t, bow, guidance);
      const x0 = pred.x0;
      const ab = Math.max(sched.alphaBar[t] ?? 0.002, 1e-4);
      const sqrtAb = Math.sqrt(ab);
      const sqrtOne = Math.sqrt(Math.max(1 - ab, 1e-4));
      const next =
        tPrev < 0
          ? x0
          : tf.tidy(() => {
              const eps = x.sub(x0.mul(sqrtAb)).div(sqrtOne);
              const abp = Math.max(sched.alphaBar[tPrev] ?? 0.002, 1e-4);
              return x0.mul(Math.sqrt(abp)).add(eps.mul(Math.sqrt(Math.max(1 - abp, 0))));
            });
      x.dispose();
      pred.dispose();
      if (tPrev >= 0) x0.dispose();
      x = next;

      if (opts.onStep) {
        const squeezed = x.squeeze();
        const frame = await tensorToImageData(tf, squeezed, size, false);
        squeezed.dispose();
        opts.onStep(frame, i + 1, total);
        if (typeof window !== "undefined") await tf.nextFrame();
      }
    }

    const clean = predictX0(tf, net, x, 0, bow, guidance);
    x.dispose();
    x = clean.x0;
    clean.dispose();

    const squeezed = x.squeeze();
    const final = await tensorToImageData(tf, squeezed, size, true);
    squeezed.dispose();
    if (opts.onStep) opts.onStep(final, total, total);
    return final;
  } finally {
    x.dispose();
    bow.dispose();
  }
}

async function tensorToImageData(
  tf: Tf,
  t: Tensor,
  size: number,
  soften: boolean,
): Promise<ImageData> {
  const rgb01 = tf.tidy(() => t.clipByValue(-1, 1).add(1).div(2));
  const data = await rgb01.data();
  rgb01.dispose();
  const raw = new Float32Array(data.length);
  raw.set(data);
  const rgb = soften ? softenRgb(raw, size, 0.3) : raw;
  return rgbToImageData(rgb, size);
}

export async function disposeModel(): Promise<void> {
  if (model) {
    model.dispose();
    model = null;
  }
  if (tfMod) {
    try {
      await tfMod.io.removeModel(MODEL_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function memoryInfo(): { numTensors: number; numBytes: number } {
  if (!tfMod) return { numTensors: 0, numBytes: 0 };
  const m = tfMod.memory();
  return { numTensors: m.numTensors, numBytes: m.numBytes };
}
