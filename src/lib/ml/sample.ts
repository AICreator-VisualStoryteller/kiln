export type SampleItem = { caption: string; blob: Blob; name: string };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS: { name: string; adj: string; hex: string }[] = [
  { name: "rood", adj: "rode", hex: "#c45c4a" },
  { name: "blauw", adj: "blauwe", hex: "#5b7c9a" },
  { name: "geel", adj: "gele", hex: "#c4a574" },
  { name: "groen", adj: "groene", hex: "#7d9a7e" },
];

const BACKGROUNDS = ["#161618", "#e6e1d8"];

function paintBg(ctx: CanvasRenderingContext2D, size: number, rng: () => number, light: boolean) {
  ctx.fillStyle = light ? BACKGROUNDS[1]! : BACKGROUNDS[0]!;
  ctx.fillRect(0, 0, size, size);
  const n = 30 + Math.floor(rng() * 50);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = light ? `rgba(0,0,0,${0.03 + rng() * 0.06})` : `rgba(255,255,255,${0.03 + rng() * 0.05})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, size: number, rng: () => number, hex: string) {
  ctx.fillStyle = hex;
  const r = size * (0.28 + rng() * 0.14);
  const x = size * (0.38 + rng() * 0.24);
  const y = size * (0.38 + rng() * 0.24);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSquare(ctx: CanvasRenderingContext2D, size: number, rng: () => number, hex: string) {
  ctx.fillStyle = hex;
  const s = size * (0.42 + rng() * 0.16);
  const x = size * (0.22 + rng() * 0.2);
  const y = size * (0.22 + rng() * 0.2);
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate((rng() - 0.5) * 0.2);
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawTriangle(ctx: CanvasRenderingContext2D, size: number, rng: () => number, hex: string) {
  ctx.fillStyle = hex;
  const s = size * (0.48 + rng() * 0.14);
  const cx = size * (0.42 + rng() * 0.16);
  const cy = size * (0.44 + rng() * 0.14);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rng() - 0.5) * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, -s / 1.6);
  ctx.lineTo(s / 1.6, s / 1.8);
  ctx.lineTo(-s / 1.6, s / 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const SHAPES: { noun: string; draw: typeof drawCircle }[] = [
  { noun: "cirkel", draw: drawCircle },
  { noun: "vierkant", draw: drawSquare },
  { noun: "driehoek", draw: drawTriangle },
];

function captionFor(adj: string, noun: string, light: boolean): string {
  const paper = light ? "lichte" : "donkere";
  return `een ${adj} ${noun} op ${paper} achtergrond`;
}

function renderBlob(
  draw: typeof drawCircle,
  hex: string,
  light: boolean,
  seed: number,
  size = 256,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas niet beschikbaar"));
  const rng = mulberry32(seed);
  paintBg(ctx, size, rng, light);
  draw(ctx, size, rng, hex);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kon afbeelding niet maken"))),
      "image/png",
    );
  });
}

export async function generateSampleSet(): Promise<SampleItem[]> {
  const out: SampleItem[] = [];
  let n = 0;
  for (const color of COLORS) {
    for (const shape of SHAPES) {
      for (const light of [false, true]) {
        const caption = captionFor(color.adj, shape.noun, light);
        for (let v = 0; v < 3; v++) {
          const blob = await renderBlob(
            shape.draw,
            color.hex,
            light,
            Date.now() + n * 9973 + v * 131,
          );
          out.push({
            caption,
            blob,
            name: `${color.name}-${shape.noun}-${light ? "licht" : "donker"}-${v + 1}.png`,
          });
          n += 1;
        }
      }
    }
  }
  return out;
}

export const EXAMPLE_PROMPTS = [
  "een rode cirkel op donkere achtergrond",
  "een blauwe cirkel op lichte achtergrond",
  "hond, golden retriever, buiten",
  "kat, kitten, speels, foto",
  "hond, husky, sneeuw",
  "kat, pers, binnen, portret",
];
