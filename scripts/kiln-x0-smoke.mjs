#!/usr/bin/env node
/**
 * Proof that Kiln actually trains: untrained sampling is rejected,
 * loss drops, class-conditional samples split by color, safetensors export is real.
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const {
  trainDiffusion,
  sampleDiffusion,
  disposeModel,
  exportSafetensors,
  hasTrainedModel,
} = await import(pathToFileURL(join(root, "../src/lib/ml/diffusion.ts")).href);
const { readSafetensorsHeader } = await import(
  pathToFileURL(join(root, "../src/lib/ml/safetensors.ts")).href
);

function solid(size, r, g, b) {
  const rgb = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return rgb;
}

const size = 32;
const samples = [];
for (let i = 0; i < 8; i++) {
  samples.push({ rgb: solid(size, 0.86, 0.18, 0.12), caption: "rood" });
  samples.push({ rgb: solid(size, 0.12, 0.28, 0.82), caption: "blauw" });
}

let threw = false;
try {
  await sampleDiffusion({ prompt: "rood", steps: 4, guidance: 1.8 });
} catch {
  threw = true;
}
if (!threw || hasTrainedModel()) {
  console.error("FAIL: generator must refuse untrained weights");
  process.exit(1);
}
console.log("untrained sampling rejected");

const logs = [];
const t0 = Date.now();
const { info } = await trainDiffusion({
  samples,
  config: {
    epochs: 3,
    batchSize: 8,
    learningRate: 0.002,
    imageSize: 32,
    timesteps: 16,
  },
  onEpoch: (log) => {
    logs.push(log);
    console.log(`epoch ${log.epoch}  loss ${log.loss.toFixed(4)}  ${log.seconds.toFixed(2)}s`);
  },
  onStatus: (msg) => console.log(msg),
});

if (!hasTrainedModel()) {
  console.error("FAIL: model not marked trained");
  process.exit(1);
}

function meanRgb(frame) {
  const data = frame.data;
  let r = 0;
  let g = 0;
  let b = 0;
  const n = frame.width * frame.height;
  for (let i = 0; i < n; i++) {
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
  }
  return { r: r / n, g: g / n, b: b / n };
}

const redFrame = await sampleDiffusion({ prompt: "rood", steps: 8, guidance: 2.2 });
const blueFrame = await sampleDiffusion({ prompt: "blauw", steps: 8, guidance: 2.2 });
const red = meanRgb(redFrame);
const blue = meanRgb(blueFrame);
const first = logs[0];
const last = logs[logs.length - 1];

const exported = await exportSafetensors();
const header = readSafetensorsHeader(exported.bytes);

console.log(
  JSON.stringify(
    {
      params: info.params,
      updates: info.updates,
      weightHash: info.weightHash,
      firstLoss: first?.loss,
      lastLoss: last?.loss,
      ms: Date.now() - t0,
      red,
      blue,
      redMinusBlueR: red.r - blue.r,
      blueMinusRedB: blue.b - red.b,
      safetensorsBytes: exported.bytes.length,
      tensorCount: header.tensors.length,
      filename: exported.filename,
    },
    null,
    2,
  ),
);

const learned = last && first && last.loss < first.loss * 0.7 && last.loss < 0.25;
if (!learned) {
  console.error("FAIL: loss did not drop — training did not run");
  process.exit(1);
}
if (red.r - blue.r < 20 || blue.b - red.b < 20) {
  console.error("FAIL: class-conditional samples did not split (rood vs blauw)");
  process.exit(1);
}
if (header.tensors.length < 10 || exported.bytes.length < 10_000) {
  console.error("FAIL: safetensors export is empty");
  process.exit(1);
}

await disposeModel();
threw = false;
try {
  await sampleDiffusion({ prompt: "rood", steps: 4, guidance: 1.8 });
} catch {
  threw = true;
}
if (!threw) {
  console.error("FAIL: sampling still allowed after dispose");
  process.exit(1);
}

console.log("ok");
