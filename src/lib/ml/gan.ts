import type { EpochLog, ModelInfo, TrainConfig, TrainDevice, WeightDump } from "../types.ts";
import { f32ToB64, b64ToF32, rgbToImageData } from "./codec.ts";
import { bagOfWords, VOCAB_SIZE } from "./text.ts";
import { getTf, ensureBackend, type RgbSample, resolveRgb } from "./diffusion.ts";
import { trainCheckpoint, resetTrainControl } from "./train-control.ts";

type Tf = typeof import("@tensorflow/tfjs");
type LayersModel = import("@tensorflow/tfjs").LayersModel;
type SymbolicTensor = import("@tensorflow/tfjs").SymbolicTensor;
type Tensor = import("@tensorflow/tfjs").Tensor;

const Z = 64;
const TXT = 32;

let generator: LayersModel | null = null;
let ganReady = false;
let imageSize = 32;

function asSym(x: unknown): SymbolicTensor {
  return x as SymbolicTensor;
}

function upSteps(size: number): number {
  return Math.max(1, Math.round(Math.log2(size / 4)));
}

function channelPlan(size: number, steps: number): number[] {
  const head = size >= 512 ? 24 : size >= 128 ? 48 : size >= 64 ? 64 : 96;
  const plan = [head];
  for (let i = 0; i < steps; i++) {
    plan.push(Math.max(12, Math.round(head / 1.45 ** (i + 1))));
  }
  return plan;
}

export function buildGenerator(tf: Tf, size: number): LayersModel {
  const zIn = tf.input({ shape: [Z], name: "z" });
  const bowIn = tf.input({ shape: [VOCAB_SIZE], name: "bow" });
  const txt = asSym(
    tf.layers.dense({ units: TXT, activation: "relu", name: "g_txt" }).apply(bowIn),
  );
  const mixed = asSym(tf.layers.concatenate({ name: "g_mix" }).apply([zIn, txt]));
  const steps = upSteps(size);
  const chans = channelPlan(size, steps);
  const start = 4;
  const flat = asSym(
    tf.layers
      .dense({
        units: start * start * chans[0]!,
        activation: "relu",
        kernelInitializer: "glorotNormal",
        name: "g_proj",
      })
      .apply(mixed),
  );
  let x = asSym(tf.layers.reshape({ targetShape: [start, start, chans[0]!], name: "g_reshape" }).apply(flat));
  for (let i = 0; i < steps; i++) {
    const up = asSym(tf.layers.upSampling2d({ size: [2, 2], name: `g_up${i}` }).apply(x));
    const conv = asSym(
      tf.layers
        .conv2d({
          filters: chans[i + 1]!,
          kernelSize: 3,
          padding: "same",
          kernelInitializer: "glorotNormal",
          name: `g_conv${i}`,
        })
        .apply(up),
    );
    x = asSym(tf.layers.leakyReLU({ alpha: 0.2, name: `g_act${i}` }).apply(conv));
  }
  const out = asSym(
    tf.layers
      .conv2d({
        filters: 3,
        kernelSize: 3,
        padding: "same",
        activation: "tanh",
        kernelInitializer: "glorotNormal",
        name: "g_rgb",
      })
      .apply(x),
  );
  return tf.model({ inputs: [zIn, bowIn], outputs: out, name: "kiln_gan_g" });
}

export function buildDiscriminator(tf: Tf, size: number): LayersModel {
  const img = tf.input({ shape: [size, size, 3], name: "img" });
  const bowIn = tf.input({ shape: [VOCAB_SIZE], name: "bow" });
  const steps = upSteps(size);
  let x: SymbolicTensor = img;
  let filters = size >= 128 ? 24 : 32;
  for (let i = 0; i < steps; i++) {
    const conv = asSym(
      tf.layers
        .conv2d({
          filters,
          kernelSize: 3,
          strides: 2,
          padding: "same",
          kernelInitializer: "glorotNormal",
          name: `d_conv${i}`,
        })
        .apply(x),
    );
    x = asSym(tf.layers.leakyReLU({ alpha: 0.2, name: `d_act${i}` }).apply(conv));
    filters = Math.min(128, filters * 2);
  }
  const flat = asSym(tf.layers.flatten({ name: "d_flat" }).apply(x));
  const hid = asSym(tf.layers.dense({ units: 64, activation: "relu", name: "d_hid" }).apply(flat));
  const txt = asSym(tf.layers.dense({ units: TXT, activation: "relu", name: "d_txt" }).apply(bowIn));
  const cat = asSym(tf.layers.concatenate({ name: "d_cat" }).apply([hid, txt]));
  const score = asSym(
    tf.layers.dense({ units: 1, activation: "sigmoid", name: "d_score" }).apply(cat),
  );
  return tf.model({ inputs: [img, bowIn], outputs: score, name: "kiln_gan_d" });
}

async function hashOf(m: LayersModel): Promise<string> {
  const ws = m.getWeights();
  const first = await ws[0]!.data();
  let h = 2166136261;
  const n = Math.min(first.length, 2048);
  for (let i = 0; i < n; i++) {
    h ^= Math.floor(((first[i] ?? 0) + 3) * 1e6) >>> 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function dumpModel(m: LayersModel): Promise<WeightDump> {
  const ws = m.getWeights();
  const shapes = ws.map((w) => [...w.shape]);
  const dataB64: string[] = [];
  for (const w of ws) dataB64.push(f32ToB64(await w.data()));
  return { shapes, dataB64 };
}

export async function snapshotGan(): Promise<WeightDump | null> {
  if (!generator) return null;
  return dumpModel(generator);
}

export function hasGanModel(): boolean {
  return ganReady && generator !== null;
}

export function disposeGan(): void {
  ganReady = false;
  if (generator) {
    generator.dispose();
    generator = null;
  }
}

export async function loadGanWeights(dump: WeightDump, size: number): Promise<void> {
  const tf = await getTf();
  disposeGan();
  const net = buildGenerator(tf, size);
  const tensors = dump.shapes.map((shape, i) => tf.tensor(b64ToF32(dump.dataB64[i]!), shape));
  net.setWeights(tensors);
  tensors.forEach((t) => t.dispose());
  generator = net;
  imageSize = size;
  ganReady = true;
}

export async function sampleGan(opts: { prompt: string }): Promise<ImageData> {
  if (!generator || !ganReady) throw new Error("Geen GAN — train of laad een model uit de galerij");
  const tf = await getTf();
  const size = imageSize;
  const z = tf.randomNormal([1, Z]);
  const bow = tf.tensor2d(bagOfWords(opts.prompt), [1, VOCAB_SIZE]);
  const out = generator.predict([z, bow]) as Tensor;
  const raw = await out.data();
  z.dispose();
  bow.dispose();
  out.dispose();
  const rgb = new Float32Array(size * size * 3);
  for (let i = 0; i < rgb.length; i++) rgb[i] = ((raw[i] ?? 0) + 1) * 0.5;
  return rgbToImageData(rgb, size);
}

export async function trainGan(opts: {
  samples: RgbSample[];
  config: TrainConfig;
  device?: TrainDevice;
  onEpoch: (log: EpochLog) => void;
  onStatus: (msg: string) => void;
  onBatch?: (done: number, total: number) => void;
  onPaused?: (paused: boolean) => void;
  resume?: WeightDump;
}): Promise<{ info: ModelInfo; weights: WeightDump }> {
  resetTrainControl();
  disposeGan();
  const device = opts.device ?? (typeof window === "undefined" ? "cpu" : "gpu");
  const tf = await ensureBackend(device);
  const size = opts.config.imageSize;
  imageSize = size;
  const n = opts.samples.length;
  if (n < 4) throw new Error("Minstens vier beelden nodig");

  opts.onStatus(`GAN · generator+discriminator · ${size}×${size}`);
  const gen = buildGenerator(tf, size);
  const disc = buildDiscriminator(tf, size);
  const lr = opts.config.learningRate;
  disc.trainable = false;
  const fakeImg = gen.apply(gen.inputs) as SymbolicTensor;
  const score = disc.apply([fakeImg, gen.inputs[1]!]) as SymbolicTensor;
  const gan = tf.model({ inputs: gen.inputs, outputs: score, name: "kiln_gan" });
  gan.compile({
    optimizer: tf.train.adam(lr, 0.5, 0.999),
    loss: "binaryCrossentropy",
  });
  disc.trainable = true;
  disc.compile({
    optimizer: tf.train.adam(lr * 0.4, 0.5, 0.999),
    loss: "binaryCrossentropy",
  });
  if (opts.resume && opts.resume.shapes.length === gen.getWeights().length) {
    const tensors = opts.resume.shapes.map((shape, i) =>
      tf.tensor(b64ToF32(opts.resume!.dataB64[i]!), shape),
    );
    gen.setWeights(tensors);
    tensors.forEach((t) => t.dispose());
  }

  const initHash = await hashOf(gen);
  const batchSize = Math.min(opts.config.batchSize, n);
  const steps = Math.max(1, Math.ceil(n / batchSize));
  let lastG = 0;
  let firstG = 0;
  let updates = 0;
  let epochsDone = 0;
  let lastAt = performance.now();

  const cache = new Map<number, Float32Array>();
  async function rgbAt(i: number): Promise<Float32Array> {
    const hit = cache.get(i);
    if (hit) return hit;
    const rgb = await resolveRgb(opts.samples[i]!);
    cache.set(i, rgb);
    return rgb;
  }

  try {
    for (let epoch = 0; epoch < opts.config.epochs; epoch++) {
      let gSum = 0;
      let dSum = 0;
      let stepCount = 0;
      for (let step = 0; step < steps; step++) {
        await trainCheckpoint(opts.onPaused);
        const start = (step * batchSize) % n;
        const idx: number[] = [];
        for (let k = 0; k < batchSize; k++) idx.push((start + k) % n);
        const b = idx.length;
        const pix = size * size * 3;
        const xData = new Float32Array(b * pix);
        const bowData = new Float32Array(b * VOCAB_SIZE);
        for (let k = 0; k < b; k++) {
          const rgb = await rgbAt(idx[k]!);
          for (let j = 0; j < pix; j++) xData[k * pix + j] = (rgb[j] ?? 0) * 2 - 1;
          bowData.set(bagOfWords(opts.samples[idx[k]!]!.caption), k * VOCAB_SIZE);
        }
        const real = tf.tensor4d(xData, [b, size, size, 3]);
        const bow = tf.tensor2d(bowData, [b, VOCAB_SIZE]);
        const realY = tf.ones([b, 1]).mul(0.9);
        const fakeY = tf.zeros([b, 1]);
        const z = tf.randomNormal([b, Z]);
        const fake = gen.predict([z, bow]) as Tensor;
        const dReal = Number(await disc.trainOnBatch([real, bow], realY));
        const dFake = Number(await disc.trainOnBatch([fake, bow], fakeY));
        fake.dispose();
        z.dispose();
        const z2 = tf.randomNormal([b, Z]);
        const gY = tf.ones([b, 1]);
        const gLoss = Number(await gan.trainOnBatch([z2, bow], gY));
        z2.dispose();
        gY.dispose();
        real.dispose();
        bow.dispose();
        realY.dispose();
        fakeY.dispose();
        gSum += gLoss;
        dSum += (dReal + dFake) / 2;
        stepCount += 1;
        updates += 2;
        opts.onBatch?.(epoch * steps + stepCount, opts.config.epochs * steps);
        if (typeof window !== "undefined") await tf.nextFrame();
      }
      lastG = gSum / Math.max(1, stepCount);
      if (epoch === 0) firstG = lastG;
      const now = performance.now();
      const dLoss = dSum / Math.max(1, stepCount);
      opts.onEpoch({ epoch: epoch + 1, loss: lastG, seconds: (now - lastAt) / 1000 });
      opts.onStatus(`epoch ${epoch + 1}  G ${lastG.toFixed(3)}  D ${dLoss.toFixed(3)}`);
      lastAt = now;
      epochsDone = epoch + 1;
    }
  } catch (err) {
    const stopped = err instanceof Error && err.message === "Training gestopt";
    if (stopped && updates > 0) {
      const weights = await dumpModel(gen);
      const finalHash = await hashOf(gen);
      gan.dispose();
      disc.dispose();
      generator = gen;
      ganReady = true;
      const info: ModelInfo = {
        params: gen.getWeights().reduce((s, w) => s + w.size, 0),
        layers: [],
        imageSize: size,
        timesteps: 0,
        trainedAt: Date.now(),
        finalLoss: lastG,
        firstLoss: firstG,
        backend: tf.getBackend(),
        epochs: opts.config.epochs,
        epochsDone,
        partial: true,
        sampleCount: n,
        compute: "local",
        weightHash: finalHash,
        updates,
        arch: "gan",
      };
      return { info, weights };
    }
    gan.dispose();
    disc.dispose();
    gen.dispose();
    generator = null;
    ganReady = false;
    throw err;
  }

  const finalHash = await hashOf(gen);
  if (finalHash === initHash) {
    gan.dispose();
    disc.dispose();
    gen.dispose();
    throw new Error("GAN-gewichten zijn niet veranderd — training heeft niets gedaan");
  }
  const weights = await dumpModel(gen);
  const layers = gen.layers.map((layer) => {
    let params = 0;
    for (const w of layer.getWeights()) params += w.size;
    return { name: layer.name, params };
  });
  const params = layers.reduce((s, l) => s + l.params, 0) + disc.layers.reduce((s, layer) => {
    let nparams = 0;
    for (const w of layer.getWeights()) nparams += w.size;
    return s + nparams;
  }, 0);
  gan.dispose();
  disc.dispose();
  generator = gen;
  ganReady = true;
  const info: ModelInfo = {
    params,
    layers,
    imageSize: size,
    timesteps: 0,
    trainedAt: Date.now(),
    finalLoss: lastG,
    firstLoss: firstG,
    backend: tf.getBackend(),
    epochs: opts.config.epochs,
    sampleCount: n,
    compute: "local",
    weightHash: finalHash,
    updates,
    arch: "gan",
  };
  return { info, weights };
}
