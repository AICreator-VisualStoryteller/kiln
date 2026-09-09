//#region node_modules/.nitro/vite/services/ssr/assets/sample-CnfV7EAZ.js
function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = seed + 1831565813 | 0;
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
var COLORS = [
	{
		name: "rood",
		adj: "rode",
		hex: "#c45c4a"
	},
	{
		name: "blauw",
		adj: "blauwe",
		hex: "#5b7c9a"
	},
	{
		name: "geel",
		adj: "gele",
		hex: "#c4a574"
	},
	{
		name: "groen",
		adj: "groene",
		hex: "#7d9a7e"
	}
];
var BACKGROUNDS = ["#161618", "#e6e1d8"];
function paintBg(ctx, size, rng, light) {
	ctx.fillStyle = light ? BACKGROUNDS[1] : BACKGROUNDS[0];
	ctx.fillRect(0, 0, size, size);
	const n = 30 + Math.floor(rng() * 50);
	for (let i = 0; i < n; i++) {
		ctx.fillStyle = light ? `rgba(0,0,0,${.03 + rng() * .06})` : `rgba(255,255,255,${.03 + rng() * .05})`;
		ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
	}
}
function drawCircle(ctx, size, rng, hex) {
	ctx.fillStyle = hex;
	const r = size * (.28 + rng() * .14);
	const x = size * (.38 + rng() * .24);
	const y = size * (.38 + rng() * .24);
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}
function drawSquare(ctx, size, rng, hex) {
	ctx.fillStyle = hex;
	const s = size * (.42 + rng() * .16);
	const x = size * (.22 + rng() * .2);
	const y = size * (.22 + rng() * .2);
	ctx.save();
	ctx.translate(x + s / 2, y + s / 2);
	ctx.rotate((rng() - .5) * .2);
	ctx.fillRect(-s / 2, -s / 2, s, s);
	ctx.restore();
}
function drawTriangle(ctx, size, rng, hex) {
	ctx.fillStyle = hex;
	const s = size * (.48 + rng() * .14);
	const cx = size * (.42 + rng() * .16);
	const cy = size * (.44 + rng() * .14);
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate((rng() - .5) * .35);
	ctx.beginPath();
	ctx.moveTo(0, -s / 1.6);
	ctx.lineTo(s / 1.6, s / 1.8);
	ctx.lineTo(-s / 1.6, s / 1.8);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
var SHAPES = [
	{
		noun: "cirkel",
		draw: drawCircle
	},
	{
		noun: "vierkant",
		draw: drawSquare
	},
	{
		noun: "driehoek",
		draw: drawTriangle
	}
];
function captionFor(adj, noun, light) {
	return `een ${adj} ${noun} op ${light ? "lichte" : "donkere"} achtergrond`;
}
function renderBlob(draw, hex, light, seed, size = 256) {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) return Promise.reject(/* @__PURE__ */ new Error("Canvas niet beschikbaar"));
	const rng = mulberry32(seed);
	paintBg(ctx, size, rng, light);
	draw(ctx, size, rng, hex);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("Kon afbeelding niet maken")), "image/png");
	});
}
async function generateSampleSet() {
	const out = [];
	let n = 0;
	for (const color of COLORS) for (const shape of SHAPES) for (const light of [false, true]) {
		const caption = captionFor(color.adj, shape.noun, light);
		for (let v = 0; v < 3; v++) {
			const blob = await renderBlob(shape.draw, color.hex, light, Date.now() + n * 9973 + v * 131);
			out.push({
				caption,
				blob,
				name: `${color.name}-${shape.noun}-${light ? "licht" : "donker"}-${v + 1}.png`
			});
			n += 1;
		}
	}
	return out;
}
var EXAMPLE_PROMPTS = [
	"een rode cirkel op donkere achtergrond",
	"een blauwe cirkel op lichte achtergrond",
	"een geel vierkant op donkere achtergrond",
	"een groene driehoek op lichte achtergrond",
	"een rode driehoek op donkere achtergrond"
];
//#endregion
export { generateSampleSet as n, EXAMPLE_PROMPTS as t };
