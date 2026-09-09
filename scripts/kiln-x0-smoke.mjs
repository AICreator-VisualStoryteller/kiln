#!/usr/bin/env node
/**
 * Train a tiny x0-DDPM on synthetic shapes and check that sampling
 * is not TV-static (dominant color + darker corners on a "dark bg" prompt).
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const { trainDiffusion, sampleDiffusion, disposeModel } = await import(
  pathToFileURL(join(root, "../src/lib/ml/diffusion.ts")).href
);

function circle(size, r, g, b, dark) {
  const rgb = new Float32Array(size * size * 3);
  const bg = dark ? 0.09 : 0.9;
  const cx = size / 2;
  const cy = size / 2;
  const rad = size * 0.3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 < rad * rad;
      const i = (y * size + x) * 3;
      rgb[i] = inside ? r : bg;
      rgb[i + 1] = inside ? g : bg;
      rgb[i + 2] = inside ? b : bg;
    }
  }
  return rgb;
}

function square(size, r, g, b, dark) {
  const rgb = new Float32Array(size * size * 3);
  const bg = dark ? 0.09 : 0.9;
  const lo = Math.floor(size * 0.28);
  const hi = Math.ceil(size * 0.72);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = x >= lo && x < hi && y >= lo && y < hi;
      const i = (y * size + x) * 3;
      rgb[i] = inside ? r : bg;
      rgb[i + 1] = inside ? g : bg;
      rgb[i + 2] = inside ? b : bg;
    }
  }
  return rgb;
}

const size = 32;
const samples = [
  { rgb: circle(size, 0.77, 0.36, 0.29, true), caption: "een rode cirkel op donkere achtergrond" },
  { rgb: circle(size, 0.74, 0.34, 0.28, true), caption: "een rode cirkel op donkere achtergrond" },
  { rgb: circle(size, 0.36, 0.49, 0.6, true), caption: "een blauwe cirkel op donkere achtergrond" },
  { rgb: circle(size, 0.77, 0.36, 0.29, false), caption: "een rode cirkel op lichte achtergrond" },
  { rgb: square(size, 0.77, 0.65, 0.45, true), caption: "een geel vierkant op donkere achtergrond" },
  { rgb: square(size, 0.49, 0.6, 0.49, false), caption: "een groene vierkant op lichte achtergrond" },
  { rgb: square(size, 0.36, 0.49, 0.6, true), caption: "een blauw vierkant op donkere achtergrond" },
  { rgb: circle(size, 0.49, 0.6, 0.49, true), caption: "een groene cirkel op donkere achtergrond" },
];

const logs = [];
const t0 = Date.now();
const { info } = await trainDiffusion({
  samples,
  config: {
    epochs: 8,
    batchSize: 4,
    learningRate: 0.001,
    imageSize: 32,
    timesteps: 16,
  },
  onEpoch: (log) => {
    logs.push(log);
    console.log(`epoch ${log.epoch}  loss ${log.loss.toFixed(4)}  ${log.seconds.toFixed(2)}s`);
  },
  onStatus: (msg) => console.log(msg),
});

const frame = await sampleDiffusion({
  prompt: "een rode cirkel op donkere achtergrond",
  steps: 8,
  guidance: 1.4,
});

const w = frame.width;
const data = frame.data;
function mean(x0, y0, x1, y1) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  return { r: r / n, g: g / n, b: b / n, lum: (r + g + b) / (3 * n) };
}

const center = mean(Math.floor(w * 0.35), Math.floor(w * 0.35), Math.ceil(w * 0.65), Math.ceil(w * 0.65));
const corner = mean(0, 0, Math.floor(w * 0.2), Math.floor(w * 0.2));
const last = logs[logs.length - 1];
const first = logs[0];

console.log(
  JSON.stringify(
    {
      params: info.params,
      firstLoss: first?.loss,
      lastLoss: last?.loss,
      ms: Date.now() - t0,
      center,
      corner,
      redOverGreen: center.r - center.g,
      cornerDarker: corner.lum < center.lum + 15,
    },
    null,
    2,
  ),
);

const learned = last && last.loss < first.loss * 0.85 && last.loss < 0.35;
const notStatic = Math.abs(center.r - corner.r) > 8 || Math.abs(center.lum - corner.lum) > 8;
if (!learned) {
  console.error("FAIL: loss did not drop enough");
  process.exit(1);
}
if (!notStatic) {
  console.error("FAIL: sample looks like uncorrelated noise (center≈corners)");
  process.exit(1);
}
console.log("ok");
await disposeModel();
