import type { EpochLog, GpuInfo, ModelInfo, TrainConfig, TrainDevice, WeightDump } from "../types.ts";
import { asImageSize } from "../types.ts";
import { b64ToF32, f32ToB64, rgbToImageData, softenRgb } from "./codec.ts";
import {
  decodeSafetensors,
  encodeSafetensors,
  triggerDownload,
  type NamedTensor,
} from "./safetensors.ts";
import { ddimTimesteps, makeSchedule } from "./schedule.ts";
import { trainCheckpoint, resetTrainControl, requestAbort } from "./train-control.ts";
import { bagOfWords, VOCAB_SIZE } from "./text.ts";

type Tf = typeof import("@tensorflow/tfjs");
type LayersModel = import("@tensorflow/tfjs").LayersModel;
type SymbolicTensor = import("@tensorflow/tfjs").SymbolicTensor;
type Tensor = import("@tensorflow/tfjs").Tensor;

const MODEL_KEY = "indexeddb://kiln-ddpm-eps-v4";
const T_EMB = 32;
const COND = 96;
const UNCOND_P = 0.12;

let tfMod: Tf | null = null;
let model: LayersModel | null = null;
let imageSize = 32;
let timesteps = 20;
let abortFlag = false;
let trained = false;
let activeDevice: TrainDevice | null = null;

function wantedBackend(device: TrainDevice): "cpu" | "webgl" {
  if (device === "cpu" || typeof window === "undefined") return "cpu";
  return "webgl";
}

export async function ensureBackend(device: TrainDevice): Promise<Tf> {
  const tf = tfMod ?? (await import("@tensorflow/tfjs"));
  const wanted = wantedBackend(device);
  let current: string | null = null;
  try {
    current = tf.getBackend();
  } catch {
    current = null;
  }
  if (tfMod && current === wanted && activeDevice === device) return tf;

  if (model) {
    model.dispose();
    model = null;
    trained = false;
  }

  try {
    const ok = await tf.setBackend(wanted);
    if (!ok) {
      if (wanted === "webgl") {
        throw new Error("Geen GPU/WebGL beschikbaar. Kies CPU of verbind een GPU-server.");
      }
      throw new Error("CPU-backend startte niet");
    }
  } catch (err) {
    if (wanted === "webgl") {
      throw err instanceof Error && /GPU|WebGL/i.test(err.message)
        ? err
        : new Error("Geen GPU/WebGL beschikbaar. Kies CPU of verbind een GPU-server.");
    }
    throw err;
  }
  await tf.ready();
  tf.enableProdMode();
  tfMod = tf;
  activeDevice = device;
  return tf;
}

export async function getTf(): Promise<Tf> {
  return ensureBackend(activeDevice ?? (typeof window === "undefined" ? "cpu" : "gpu"));
}

export function getGpuRenderer(): string {
  if (tfMod?.getBackend() === "cpu" || typeof document === "undefined") {
    return typeof document === "undefined" ? "Node CPU" : "CPU van dit apparaat";
  }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FilmCtor: any = null;

function getFilm(tf: Tf, name: string) {
  if (!FilmCtor) {
    class KilnFilm extends tf.layers.Layer {
      static className = "KilnFilm";
      constructor(args: { name?: string } = {}) {
        super(args);
      }
      computeOutputShape(inputShape: unknown) {
        return (inputShape as number[][])[0];
      }
      call(inputs: Tensor | Tensor[]): Tensor {
        const list = Array.isArray(inputs) ? inputs : [inputs];
        const x = list[0]!;
        const gamma = list[1]!;
        const beta = list[2]!;
        const bs = x.shape[0] ?? 1;
        const c = gamma.shape[1] ?? 1;
        const g = gamma.reshape([bs, 1, 1, c]);
        const b = beta.reshape([bs, 1, 1, c]);
        return x.mul(g.add(1)).add(b);
      }
    }
    tf.serialization.registerClass(KilnFilm);
    FilmCtor = KilnFilm;
  }
  return new FilmCtor({ name }) as import("@tensorflow/tfjs").layers.Layer;
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

/** FiLM: x * (1 + γ(cond)) + β(cond), broadcast over space. */
function addCond(
  tf: Tf,
  x: SymbolicTensor,
  cond: SymbolicTensor,
  filters: number,
  _spatial: number,
  name: string,
): SymbolicTensor {
  const gamma = asSym(
    tf.layers
      .dense({
        units: filters,
        kernelInitializer: "zeros",
        biasInitializer: "zeros",
        name: `${name}_gamma`,
      })
      .apply(cond),
  );
  const beta = asSym(
    tf.layers
      .dense({
        units: filters,
        kernelInitializer: "zeros",
        biasInitializer: "zeros",
        name: `${name}_beta`,
      })
      .apply(cond),
  );
  return asSym(getFilm(tf, `${name}_film`).apply([x, gamma, beta]));
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
        kernelInitializer: "glorotNormal",
        name: "eps",
      })
      .apply(dec1),
  );

  return tf.model({ inputs: [noisy, tembIn, bowIn], outputs: out, name: "kiln_eps" });
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

function hashF32(data: ArrayLike<number>): string {
  let h = 2166136261;
  const n = Math.min(data.length, 4096);
  const step = Math.max(1, Math.floor(data.length / n));
  for (let i = 0; i < data.length; i += step) {
    const x = Math.floor(((data[i] ?? 0) + 3) * 1e6);
    h ^= x >>> 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function weightHashOf(m: LayersModel = model!): Promise<string> {
  if (!m) return "none";
  const ws = m.getWeights();
  if (!ws.length) return "empty";
  const first = await ws[0]!.data();
  const last = await ws[ws.length - 1]!.data();
  return `${hashF32(first)}${hashF32(last)}`;
}

export async function trainDiffusion(opts: {
  samples: RgbSample[];
  config: TrainConfig;
  device?: TrainDevice;
  onEpoch: (log: EpochLog) => void;
  onStatus: (msg: string) => void;
  onBatch?: (done: number, total: number) => void;
  onPaused?: (paused: boolean) => void;
  resume?: WeightDump;
}): Promise<{ info: ModelInfo; weights: WeightDump }> {
  abortFlag = false;
  resetTrainControl();
  trained = false;
  const device = opts.device ?? (typeof window === "undefined" ? "cpu" : "gpu");
  const tf = await ensureBackend(device);
  const { samples, config } = opts;
  const size = config.imageSize;
  const T = config.timesteps;
  imageSize = size;
  timesteps = T;
  const sched = makeSchedule(T);

  opts.onStatus(`backend ${tf.getBackend()} · eps-U-Net ${size}×${size} · T=${T}`);

  if (model) {
    model.dispose();
    model = null;
  }
  model = buildUnet(tf, size);
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: "meanSquaredError",
  });
  if (opts.resume && opts.resume.shapes.length === model.getWeights().length) {
    const tensors = opts.resume.shapes.map((shape, i) =>
      tf.tensor(b64ToF32(opts.resume!.dataB64[i]!), shape),
    );
    model.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }
  const net = model;
  const initHash = await weightHashOf(net);

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
  const baseSteps = Math.max(1, Math.ceil(n / batchSize));
  const minUpdates = size >= 512 ? 8 : size >= 128 ? 12 : 16;
  const inner = Math.max(1, Math.ceil(minUpdates / baseSteps));
  const stepsPerEpoch = baseSteps * inner;
  let lastLoss = 0;
  let firstLoss = 0;
  let updates = 0;
  let epochsDone = 0;
  const t0 = performance.now();
  let lastAt = t0;

  try {
    for (let epoch = 0; epoch < config.epochs; epoch++) {
      await trainCheckpoint(opts.onPaused);
      let epochLoss = 0;
      let stepCount = 0;
      for (let rep = 0; rep < inner; rep++) {
        const order = shuffleIndices(n);
        for (let step = 0; step < baseSteps; step++) {
          await trainCheckpoint(opts.onPaused);
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
          const tFloat = tf.randomUniform([b], 0, T);
          const tInt = tFloat.floor().toInt();
          tFloat.dispose();
          const ab = tf.gather(alphaBar, tInt).reshape([b, 1, 1, 1]);
          const noise = tf.randomNormal(x0.shape as [number, number, number, number]);
          const xt = x0.mul(ab.sqrt()).add(noise.mul(tf.sub(1, ab).sqrt()));
          const tEmb = tf.tidy(() => sinusoidT(tf, tInt));

          const out = await net.trainOnBatch([xt, tEmb, bow], noise);
          const loss = Array.isArray(out) ? Number(out[0]) : Number(out);
          epochLoss += loss;
          stepCount += 1;
          updates += 1;

          x0.dispose();
          bow.dispose();
          tInt.dispose();
          ab.dispose();
          noise.dispose();
          xt.dispose();
          tEmb.dispose();

          opts.onBatch?.(epoch * stepsPerEpoch + stepCount, config.epochs * stepsPerEpoch);
          if (typeof window !== "undefined") await tf.nextFrame();
        }
      }
      lastLoss = epochLoss / Math.max(1, stepCount);
      if (epoch === 0) firstLoss = lastLoss;
      const now = performance.now();
      opts.onEpoch({
        epoch: epoch + 1,
        loss: lastLoss,
        seconds: (now - lastAt) / 1000,
      });
      lastAt = now;
      epochsDone = epoch + 1;
    }
  } catch (err) {
    const stopped = err instanceof Error && err.message === "Training gestopt";
    if (stopped && updates > 0 && model) {
      alphaBar.dispose();
      cache.clear();
      const finalHash = await weightHashOf(model);
      const layers = countParams(model);
      const params = layers.reduce((s, l) => s + l.params, 0);
      const weights = await dumpWeights(model);
      trained = true;
      const info: ModelInfo = {
        params,
        layers,
        imageSize: size,
        timesteps: T,
        trainedAt: Date.now(),
        finalLoss: lastLoss,
        firstLoss,
        backend: tf.getBackend(),
        epochs: config.epochs,
        epochsDone,
        partial: true,
        sampleCount: n,
        compute: "local",
        weightHash: finalHash,
        updates,
        arch: "diffusion",
      };
      return { info, weights };
    }
    alphaBar.dispose();
    cache.clear();
    if (model) {
      model.dispose();
      model = null;
    }
    trained = false;
    throw err;
  }
  alphaBar.dispose();
  cache.clear();

  if (!model) throw new Error("Model verdween tijdens training");
  const finalHash = await weightHashOf(model);
  if (finalHash === initHash) {
    throw new Error("Gewichten zijn niet veranderd — training heeft niets gedaan");
  }
  const layers = countParams(model);
  const params = layers.reduce((s, l) => s + l.params, 0);
  const info: ModelInfo = {
    params,
    layers,
    imageSize: size,
    timesteps: T,
    trainedAt: Date.now(),
    finalLoss: lastLoss,
    firstLoss,
    backend: tf.getBackend(),
    epochs: config.epochs,
    sampleCount: n,
    compute: "local",
    weightHash: finalHash,
    updates,
    arch: "diffusion",
  };

  opts.onStatus("Gewichten opslaan…");
  const weights = await dumpWeights(model);
  trained = true;
  try {
    await model.save(MODEL_KEY);
  } catch {
    /* dump in IDB is de bron van waarheid */
  }
  void t0;
  return { info, weights };
}

export function stopTraining(): void {
  abortFlag = true;
  requestAbort();
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
  trained = false;
  if (model) model.dispose();
  model = buildUnet(tf, size);
  imageSize = size;
  timesteps = T;
  const tensors = dump.shapes.map((shape, i) => tf.tensor(b64ToF32(dump.dataB64[i]!), shape));
  model.setWeights(tensors);
  tensors.forEach((t) => t.dispose());
  trained = true;
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
    trained = true;
    return true;
  } catch {
    trained = false;
    return false;
  }
}

export function hasModel(): boolean {
  return model !== null && trained;
}

export function hasTrainedModel(): boolean {
  return model !== null && trained;
}

export function markUntrained(): void {
  trained = false;
}

export function setMeta(size: number, T: number) {
  imageSize = size;
  timesteps = T;
}

function predictEps(
  tf: Tf,
  net: LayersModel,
  x: Tensor,
  t: number,
  bow: Tensor,
  guidance: number,
): { eps: Tensor; dispose: () => void } {
  const useCfg = guidance > 1.02;
  const tInt = tf.tensor1d(useCfg ? [t, t] : [t], "int32");
  const tEmb = tf.tidy(() => sinusoidT(tf, tInt));
  const zeros = useCfg ? tf.zeros([1, VOCAB_SIZE]) : null;
  const bowIn = useCfg && zeros ? bow.concat(zeros) : bow;
  const xIn = useCfg ? x.concat(x) : x;
  const pred = net.predict([xIn, tEmb, bowIn]) as Tensor;
  let eps: Tensor;
  if (useCfg) {
    eps = tf.tidy(() => {
      const parts = tf.split(pred, 2, 0);
      const uncond = parts[1]!;
      const cond = parts[0]!;
      return uncond.add(cond.sub(uncond).mul(guidance)).clipByValue(-6, 6);
    });
    pred.dispose();
  } else {
    eps = pred.clipByValue(-6, 6);
    pred.dispose();
  }
  const extras: Tensor[] = [tInt, tEmb];
  if (zeros) extras.push(zeros);
  if (useCfg && bowIn !== bow) extras.push(bowIn);
  if (useCfg && xIn !== x) extras.push(xIn);
  return {
    eps,
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
  if (!model || !trained) {
    throw new Error("Nog geen getraind diffusion-model — start eerst een trainingsjob");
  }
  const tf = await getTf();
  const net = model;
  const size = imageSize;
  const T = timesteps;
  const sched = makeSchedule(T);
  const nSteps = Math.max(4, Math.min(opts.steps, T));
  const times = ddimTimesteps(T, nSteps);
  const guidance = opts.guidance ?? 1.8;
  const bow = tf.tensor2d(bagOfWords(opts.prompt), [1, VOCAB_SIZE]);

  let x: Tensor = tf.randomNormal([1, size, size, 3]);
  const total = times.length;
  try {
    for (let i = 0; i < times.length; i++) {
      const t = times[i]!;
      const tPrev = i + 1 < times.length ? times[i + 1]! : -1;
      const pred = predictEps(tf, net, x, t, bow, guidance);
      const eps = pred.eps;
      const ab = Math.max(sched.alphaBar[Math.min(t, T - 1)] ?? 0.002, 1e-4);
      const abp = tPrev < 0 ? 1 : Math.max(sched.alphaBar[Math.min(tPrev, T - 1)] ?? 0.002, 1e-4);
      const next = tf.tidy(() => {
        const sqrtAb = Math.sqrt(ab);
        const sqrtOne = Math.sqrt(Math.max(1 - ab, 1e-4));
        const x0 = x.sub(eps.mul(sqrtOne)).div(sqrtAb).clipByValue(-1, 1);
        if (tPrev < 0) return x0;
        return x0.mul(Math.sqrt(abp)).add(eps.mul(Math.sqrt(Math.max(1 - abp, 0))));
      });
      x.dispose();
      pred.dispose();
      eps.dispose();
      x = next;

      if (opts.onStep) {
        const squeezed = x.squeeze();
        const frame = await tensorToImageData(tf, squeezed, size, false);
        squeezed.dispose();
        opts.onStep(frame, i + 1, total);
        if (typeof window !== "undefined") await tf.nextFrame();
      }
    }

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
  const rgb = soften ? softenRgb(raw, size, 0.18) : raw;
  return rgbToImageData(rgb, size);
}

export async function collectNamedTensors(m: LayersModel = model!): Promise<NamedTensor[]> {
  if (!m) throw new Error("Geen model");
  const out: NamedTensor[] = [];
  for (const layer of m.layers) {
    const vars = layer.weights ?? [];
    const ws = layer.getWeights();
    for (let i = 0; i < ws.length; i++) {
      const v = vars[i];
      const rawName = v?.name ?? `${layer.name}/${i === 0 ? "kernel" : "bias"}`;
      const name = rawName.replace(/:0$/, "").replace(/\//g, ".");
      const data = await ws[i]!.data();
      out.push({
        name,
        shape: [...ws[i]!.shape],
        data: Float32Array.from(data),
      });
    }
  }
  if (!out.length) throw new Error("Model heeft geen gewichten");
  return out;
}

export async function exportSafetensors(): Promise<{ bytes: Uint8Array; filename: string }> {
  if (!model || !trained) {
    throw new Error("Nog geen getraind model om te exporteren");
  }
  const tensors = await collectNamedTensors(model);
  const bytes = encodeSafetensors(tensors, {
    producer: "kiln",
    arch: "ddpm-eps-unet",
    image_size: String(imageSize),
    timesteps: String(timesteps),
    weight_layout: "tfjs",
    vocab_size: String(VOCAB_SIZE),
  });
  const filename = `kiln-ddpm-${imageSize}px-T${timesteps}.safetensors`;
  return { bytes, filename };
}

function sameShape(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function weightSpecs(m: LayersModel): { name: string; shape: number[] }[] {
  const out: { name: string; shape: number[] }[] = [];
  for (const layer of m.layers) {
    const vars = layer.weights ?? [];
    const ws = layer.getWeights();
    for (let i = 0; i < ws.length; i++) {
      const v = vars[i];
      const rawName = v?.name ?? `${layer.name}/${i === 0 ? "kernel" : "bias"}`;
      const name = rawName.replace(/:0$/, "").replace(/\//g, ".");
      out.push({ name, shape: [...ws[i]!.shape] });
    }
  }
  return out;
}

function alignImported(
  specs: { name: string; shape: number[] }[],
  incoming: NamedTensor[],
): NamedTensor[] {
  const byName = new Map(incoming.map((t) => [t.name, t]));
  if (specs.every((s) => byName.has(s.name) && sameShape(byName.get(s.name)!.shape, s.shape))) {
    return specs.map((s) => byName.get(s.name)!);
  }
  if (specs.length === incoming.length) {
    const ordered = incoming.map((t, i) => {
      const spec = specs[i]!;
      if (!sameShape(t.shape, spec.shape)) {
        throw new Error(
          `Gewicht ${i} (${t.name}) heeft vorm ${t.shape.join("×")}, verwacht ${spec.shape.join("×")}`,
        );
      }
      return t;
    });
    return ordered;
  }
  throw new Error(
    `Safetensors past niet op dit U-Net (${incoming.length} tensors, verwacht ${specs.length}). Exporteer vanuit Kiln.`,
  );
}

export async function importSafetensors(
  bytes: Uint8Array,
): Promise<{ info: ModelInfo; weights: WeightDump }> {
  const parsed = decodeSafetensors(bytes);
  const layout = (parsed.metadata.weight_layout ?? "tfjs").toLowerCase();
  if (layout && layout !== "tfjs") {
    throw new Error("Dit bestand gebruikt een andere gewichten-layout. Kiln laadt alleen zijn eigen export.");
  }
  const arch = (parsed.metadata.arch ?? "").toLowerCase();
  if (arch && arch !== "ddpm-eps-unet" && arch !== "ddpm-x0-unet") {
    throw new Error("Dit is geen Kiln DDPM-bestand (arch ontbreekt of klopt niet).");
  }

  const hintedRaw = Number(parsed.metadata.image_size);
  const hinted =
    Number.isFinite(hintedRaw) && hintedRaw > 0 ? asImageSize(hintedRaw) : null;
  const uniqueSizes = [...new Set(hinted ? [hinted, 32, 64, 128, 512] : [32, 64, 128, 512])];
  const T = Math.min(80, Math.max(8, Math.round(Number(parsed.metadata.timesteps) || 20)));

  const tf = await getTf();
  let lastErr: Error | null = null;
  let loaded = false;
  for (const size of uniqueSizes) {
    const net = buildUnet(tf, size);
    try {
      const specs = weightSpecs(net);
      const aligned = alignImported(specs, parsed.tensors);
      const tensors = aligned.map((t) => tf.tensor(t.data, t.shape));
      net.setWeights(tensors);
      tensors.forEach((t) => t.dispose());
      if (model) model.dispose();
      model = net;
      imageSize = size;
      timesteps = T;
      loaded = true;
      break;
    } catch (err) {
      net.dispose();
      lastErr = err instanceof Error ? err : new Error("import mislukt");
    }
  }
  if (!loaded || !model) {
    throw lastErr ?? new Error("Kon gewichten niet op het U-Net zetten");
  }

  trained = true;
  const layers = countParams(model);
  const params = layers.reduce((s, l) => s + l.params, 0);
  const hash = await weightHashOf(model);
  const info: ModelInfo = {
    params,
    layers,
    imageSize,
    timesteps: T,
    trainedAt: Date.now(),
    finalLoss: 0,
    firstLoss: 0,
    backend: tf.getBackend(),
    epochs: 0,
    sampleCount: 0,
    compute: "local",
    weightHash: hash,
    updates: 0,
    arch: "diffusion",
  };
  const weights = await dumpWeights(model);
  try {
    await model.save(MODEL_KEY);
  } catch {
    /* dump is source of truth */
  }
  return { info, weights };
}

export async function downloadSafetensors(): Promise<string> {
  const { bytes, filename } = await exportSafetensors();
  triggerDownload(bytes, filename);
  return filename;
}

export async function disposeModel(): Promise<void> {
  trained = false;
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
