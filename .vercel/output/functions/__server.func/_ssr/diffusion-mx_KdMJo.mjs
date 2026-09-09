import { r as __exportAll } from "../_runtime.mjs";
import { i as f32ToB64, o as rgbToImageData, t as b64ToF32 } from "./codec-CNFPhatT.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/diffusion-mx_KdMJo.js
var diffusion_mx_KdMJo_exports = /* @__PURE__ */ __exportAll({
	a: () => memoryInfo,
	c: () => setMeta,
	i: () => loadWeights,
	l: () => stopTraining,
	n: () => hasModel,
	o: () => probeGpu,
	r: () => loadSavedModel,
	s: () => sampleDiffusion,
	t: () => diffusion_exports,
	u: () => trainDiffusion
});
/** Cosine schedule (Nichol & Dhariwal). alphaBar[T-1] ≈ 0 so x_T is real noise. */
function makeSchedule(T) {
	const s = .008;
	const f = (t) => {
		const x = (t / T + s) / 1.008;
		const c = Math.cos(x * Math.PI / 2);
		return c * c;
	};
	const f0 = f(0);
	const betas = new Float32Array(T);
	const alphas = new Float32Array(T);
	const alphaBar = new Float32Array(T);
	let prev = 1;
	for (let i = 0; i < T; i++) {
		let ab = f(i + 1) / f0;
		ab = Math.min(Math.max(ab, .002), .999);
		alphaBar[i] = ab;
		const a = Math.min(Math.max(ab / prev, .001), .999);
		alphas[i] = a;
		betas[i] = 1 - a;
		prev = ab;
	}
	return {
		T,
		betas,
		alphas,
		alphaBar
	};
}
var WORDS = [
	"een",
	"a",
	"the",
	"de",
	"het",
	"op",
	"on",
	"met",
	"with",
	"rode",
	"red",
	"blauwe",
	"blue",
	"gele",
	"yellow",
	"groene",
	"green",
	"witte",
	"white",
	"zwarte",
	"black",
	"oranje",
	"orange",
	"cirkel",
	"circle",
	"vierkant",
	"square",
	"driehoek",
	"triangle",
	"ster",
	"star",
	"hart",
	"heart",
	"lichte",
	"light",
	"donkere",
	"dark",
	"achtergrond",
	"background",
	"groot",
	"big",
	"klein",
	"small",
	"rood",
	"blauw",
	"geel",
	"groen",
	"wit",
	"zwart"
];
var WORD_ID = new Map(WORDS.map((w, i) => [w, i + 1]));
var HASH_BASE = WORDS.length + 2;
var HASH_SPAN = 320 - HASH_BASE;
function hashToken(word) {
	let h = 2166136261;
	for (let i = 0; i < word.length; i++) {
		h ^= word.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return HASH_BASE + (h >>> 0) % HASH_SPAN;
}
function tokenize(text, maxLen = 12) {
	const words = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
	const ids = new Int32Array(maxLen);
	for (let i = 0; i < Math.min(words.length, maxLen); i++) {
		const w = words[i];
		ids[i] = WORD_ID.get(w) ?? hashToken(w);
	}
	return ids;
}
var diffusion_exports = /* @__PURE__ */ __exportAll$1({
	buildUnet: () => buildUnet,
	disposeModel: () => disposeModel,
	dumpWeights: () => dumpWeights,
	getGpuRenderer: () => getGpuRenderer,
	getTf: () => getTf,
	hasModel: () => hasModel,
	loadSavedModel: () => loadSavedModel,
	loadWeights: () => loadWeights,
	memoryInfo: () => memoryInfo,
	probeGpu: () => probeGpu,
	sampleDiffusion: () => sampleDiffusion,
	setMeta: () => setMeta,
	stopTraining: () => stopTraining,
	trainDiffusion: () => trainDiffusion
});
var MODEL_KEY = "indexeddb://kiln-ddpm-v2";
var T_EMB = 32;
var TXT_EMB = 48;
var COND_CH = 16;
var CFG_DROP = .08;
var DRAWS_PER_BATCH = 1;
var tfMod = null;
var model = null;
var imageSize = 16;
var timesteps = 40;
var abortFlag = false;
function shuffleIndices(n) {
	const a = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = a[i];
		a[i] = a[j];
		a[j] = tmp;
	}
	return a;
}
function asSym(x) {
	return x;
}
async function getTf() {
	if (tfMod) return tfMod;
	const tf = await import("../_libs/@tensorflow/tfjs.mjs").then((n) => n.t);
	if (typeof window !== "undefined") try {
		if (!await tf.setBackend("webgl")) await tf.setBackend("cpu");
	} catch {
		await tf.setBackend("cpu");
	}
	else await tf.setBackend("cpu");
	await tf.ready();
	tf.enableProdMode();
	tfMod = tf;
	return tf;
}
function getGpuRenderer() {
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
async function probeGpu() {
	const tf = await getTf();
	const mem = tf.memory();
	return {
		backend: tf.getBackend(),
		renderer: getGpuRenderer(),
		numTensors: mem.numTensors,
		numBytes: mem.numBytes
	};
}
function convBlock(tf, x, filters, name) {
	const a = asSym(tf.layers.conv2d({
		filters,
		kernelSize: 3,
		padding: "same",
		activation: "relu",
		kernelInitializer: "heNormal",
		name: `${name}_1`
	}).apply(x));
	return asSym(tf.layers.conv2d({
		filters,
		kernelSize: 3,
		padding: "same",
		activation: "relu",
		kernelInitializer: "heNormal",
		name: `${name}_2`
	}).apply(a));
}
function condMap(tf, vec, spatial, name) {
	const pix = asSym(tf.layers.reshape({
		targetShape: [
			1,
			1,
			COND_CH
		],
		name: `${name}_r`
	}).apply(vec));
	return asSym(tf.layers.upSampling2d({
		size: [spatial, spatial],
		interpolation: "nearest",
		name: `${name}_up`
	}).apply(pix));
}
function buildUnet(tf, size) {
	const noisy = tf.input({
		shape: [
			size,
			size,
			3
		],
		name: "x"
	});
	const tembIn = tf.input({
		shape: [T_EMB],
		name: "t"
	});
	const tokIn = tf.input({
		shape: [12],
		dtype: "int32",
		name: "tok"
	});
	const tokEmb = asSym(tf.layers.embedding({
		inputDim: 321,
		outputDim: TXT_EMB,
		name: "tok_emb"
	}).apply(tokIn));
	const tokVec = asSym(tf.layers.globalAveragePooling1d({ name: "tok_pool" }).apply(tokEmb));
	const cond = asSym(tf.layers.dense({
		units: 64,
		activation: "relu",
		name: "cond_h"
	}).apply(tf.layers.concatenate({ name: "cond_cat" }).apply([tembIn, tokVec])));
	const condPix = asSym(tf.layers.dense({
		units: COND_CH,
		name: "cond_pix"
	}).apply(cond));
	const enc1 = convBlock(tf, asSym(tf.layers.concatenate({
		axis: -1,
		name: "x_cond"
	}).apply([noisy, condMap(tf, condPix, size, "c0")])), 16, "enc1");
	const enc2 = convBlock(tf, asSym(tf.layers.maxPooling2d({
		poolSize: 2,
		name: "pool1"
	}).apply(enc1)), 32, "enc2");
	const bot = convBlock(tf, asSym(tf.layers.maxPooling2d({
		poolSize: 2,
		name: "pool2"
	}).apply(enc2)), 64, "bot");
	const u2 = asSym(tf.layers.upSampling2d({
		size: [2, 2],
		name: "up2"
	}).apply(bot));
	const dec2 = convBlock(tf, asSym(tf.layers.concatenate({
		axis: -1,
		name: "skip2"
	}).apply([u2, enc2])), 32, "dec2");
	const u1 = asSym(tf.layers.upSampling2d({
		size: [2, 2],
		name: "up1"
	}).apply(dec2));
	const dec1 = convBlock(tf, asSym(tf.layers.concatenate({
		axis: -1,
		name: "skip1"
	}).apply([u1, enc1])), 16, "dec1");
	const out = asSym(tf.layers.conv2d({
		filters: 3,
		kernelSize: 1,
		padding: "same",
		kernelInitializer: "heNormal",
		name: "x0"
	}).apply(dec1));
	return tf.model({
		inputs: [
			noisy,
			tembIn,
			tokIn
		],
		outputs: out,
		name: "kiln_ddpm"
	});
}
function countParams(m) {
	return m.layers.map((layer) => {
		let params = 0;
		for (const w of layer.getWeights()) params += w.size;
		return {
			name: layer.name,
			params
		};
	});
}
function sinusoidT(tf, t, T, dim = T_EMB) {
	const half = dim / 2;
	const freqs = tf.exp(tf.linspace(0, -Math.log(1e4), half));
	const args = t.toFloat().add(1).div(T).mul(1e3).expandDims(1).mul(freqs.reshape([1, half]));
	return tf.concat([args.sin(), args.cos()], 1);
}
async function trainDiffusion(opts) {
	abortFlag = false;
	const tf = await getTf();
	const { samples, config } = opts;
	const size = config.imageSize;
	const T = config.timesteps;
	imageSize = size;
	timesteps = T;
	const sched = makeSchedule(T);
	opts.onStatus(`backend ${tf.getBackend()} · U-Net ${size}×${size} · T=${T} · cosine x0`);
	if (model) {
		model.dispose();
		model = null;
	}
	model = buildUnet(tf, size);
	model.compile({
		optimizer: tf.train.adam(config.learningRate),
		loss: "meanSquaredError"
	});
	const net = model;
	const n = samples.length;
	const xData = new Float32Array(n * size * size * 3);
	const tokData = new Int32Array(n * 12);
	for (let i = 0; i < n; i++) {
		const s = samples[i];
		for (let j = 0; j < s.rgb.length; j++) xData[i * size * size * 3 + j] = s.rgb[j] * 2 - 1;
		tokData.set(tokenize(s.caption), i * 12);
	}
	const xs = tf.tensor4d(xData, [
		n,
		size,
		size,
		3
	]);
	const toks = tf.tensor2d(tokData, [n, 12], "int32");
	const alphaBar = tf.tensor1d(sched.alphaBar);
	const batchSize = Math.min(config.batchSize, n);
	const stepsPerEpoch = Math.ceil(n / batchSize);
	const totalBatches = config.epochs * stepsPerEpoch * DRAWS_PER_BATCH;
	let lastLoss = 0;
	let lastAt = performance.now();
	let batchN = 0;
	try {
		for (let epoch = 0; epoch < config.epochs; epoch++) {
			if (abortFlag) throw new Error("Training gestopt");
			const order = shuffleIndices(n);
			let epochLoss = 0;
			let epochSteps = 0;
			for (let step = 0; step < stepsPerEpoch; step++) {
				if (abortFlag) throw new Error("Training gestopt");
				const start = step * batchSize;
				const end = Math.min(start + batchSize, n);
				const idx = order.slice(start, end);
				const b = idx.length;
				const idxT = tf.tensor1d(idx, "int32");
				const x0 = tf.gather(xs, idxT);
				const tokKept = tf.gather(toks, idxT);
				idxT.dispose();
				const keep = tf.randomUniform([b, 1]).greater(tf.scalar(CFG_DROP)).toInt();
				const tok = tf.mul(tokKept, keep);
				tokKept.dispose();
				keep.dispose();
				for (let draw = 0; draw < DRAWS_PER_BATCH; draw++) {
					const u = tf.randomUniform([b], 0, 1);
					const tInt = u.square().mul(-1).add(1).mul(T - .001).floor().toInt();
					u.dispose();
					const ab = tf.gather(alphaBar, tInt).reshape([
						b,
						1,
						1,
						1
					]);
					const noise = tf.randomNormal(x0.shape);
					const xt = tf.tidy(() => x0.mul(ab.sqrt()).add(noise.mul(tf.sub(1, ab).sqrt())));
					const tEmb = tf.tidy(() => sinusoidT(tf, tInt, T));
					const out = await net.trainOnBatch([
						xt,
						tEmb,
						tok
					], x0);
					const loss = Array.isArray(out) ? Number(out[0]) : Number(out);
					epochLoss += loss;
					epochSteps += 1;
					tInt.dispose();
					ab.dispose();
					noise.dispose();
					xt.dispose();
					tEmb.dispose();
					batchN += 1;
					opts.onBatch?.(batchN, totalBatches);
					if (typeof window !== "undefined") await tf.nextFrame();
				}
				x0.dispose();
				tok.dispose();
			}
			lastLoss = epochLoss / Math.max(1, epochSteps);
			const now = performance.now();
			opts.onEpoch({
				epoch: epoch + 1,
				loss: lastLoss,
				seconds: (now - lastAt) / 1e3
			});
			lastAt = now;
		}
	} finally {
		xs.dispose();
		toks.dispose();
		alphaBar.dispose();
	}
	if (!model) throw new Error("Model verdween tijdens training");
	const layers = countParams(model);
	const info = {
		params: layers.reduce((s, l) => s + l.params, 0),
		layers,
		imageSize: size,
		timesteps: T,
		trainedAt: Date.now(),
		finalLoss: lastLoss,
		backend: tf.getBackend(),
		epochs: config.epochs,
		sampleCount: n,
		compute: "local"
	};
	opts.onStatus("Gewichten opslaan…");
	const weights = await dumpWeights(model);
	try {
		await model.save(MODEL_KEY);
	} catch {}
	return {
		info,
		weights
	};
}
function stopTraining() {
	abortFlag = true;
}
async function dumpWeights(m = model) {
	if (!m) throw new Error("Geen model");
	const ws = m.getWeights();
	const shapes = ws.map((w) => [...w.shape]);
	const dataB64 = [];
	for (const w of ws) {
		const data = await w.data();
		dataB64.push(f32ToB64(data));
	}
	return {
		shapes,
		dataB64
	};
}
async function loadWeights(dump, size, T) {
	const tf = await getTf();
	if (model) model.dispose();
	model = buildUnet(tf, size);
	imageSize = size;
	timesteps = T;
	const tensors = dump.shapes.map((shape, i) => tf.tensor(b64ToF32(dump.dataB64[i]), shape));
	try {
		model.setWeights(tensors);
	} finally {
		tensors.forEach((t) => t.dispose());
	}
	try {
		await model.save(MODEL_KEY);
	} catch {}
}
async function loadSavedModel(size, T) {
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
function hasModel() {
	return model !== null;
}
function setMeta(size, T) {
	imageSize = size;
	timesteps = T;
}
async function sampleDiffusion(opts) {
	if (!model) throw new Error("Nog geen getraind diffusion-model");
	const tf = await getTf();
	const size = imageSize;
	const T = timesteps;
	const sched = makeSchedule(T);
	const refineN = Math.max(1, Math.min(opts.steps, 16));
	const guidance = opts.guidance ?? 1.2;
	const tok = tf.tensor2d(tokenize(opts.prompt), [1, 12], "int32");
	const tokNull = tf.zeros([1, 12], "int32");
	const predictX0 = (xt, t) => {
		const tInt = tf.tensor1d([t], "int32");
		const tEmb = tf.tidy(() => sinusoidT(tf, tInt, T));
		const x0C = model.predict([
			xt,
			tEmb,
			tok
		]);
		let out;
		if (guidance > 1.05) {
			const x0U = model.predict([
				xt,
				tEmb,
				tokNull
			]);
			out = tf.tidy(() => x0U.add(x0C.sub(x0U).mul(guidance)).clipByValue(-1, 1));
			x0C.dispose();
			x0U.dispose();
		} else {
			out = tf.tidy(() => x0C.clipByValue(-1, 1));
			x0C.dispose();
		}
		tInt.dispose();
		tEmb.dispose();
		return out;
	};
	let x = tf.randomNormal([
		1,
		size,
		size,
		3
	]);
	let x0p = null;
	try {
		x0p = predictX0(x, T - 1);
		x.dispose();
		x = null;
		const emit = async (step) => {
			if (!opts.onStep || !x0p) return;
			const squeezed = x0p.squeeze();
			const frame = await tensorToImageData(tf, squeezed, size);
			squeezed.dispose();
			opts.onStep(frame, step, refineN);
			if (typeof window !== "undefined") await tf.nextFrame();
		};
		await emit(1);
		for (let i = 1; i < refineN; i++) {
			const frac = 1 - i / (refineN - 1);
			const t = Math.max(0, Math.round((T - 1) * .4 * frac));
			const ab = Math.max(sched.alphaBar[t] ?? .05, .05);
			const noise = tf.randomNormal([
				1,
				size,
				size,
				3
			]);
			x = tf.tidy(() => x0p.mul(Math.sqrt(ab)).add(noise.mul(Math.sqrt(Math.max(1 - ab, 0)))));
			noise.dispose();
			x0p.dispose();
			x0p = predictX0(x, t);
			x.dispose();
			x = null;
			await emit(i + 1);
		}
		const squeezed = x0p.squeeze();
		x0p.dispose();
		x0p = null;
		const final = await tensorToImageData(tf, squeezed, size);
		squeezed.dispose();
		return final;
	} finally {
		x?.dispose();
		x0p?.dispose();
		tok.dispose();
		tokNull.dispose();
	}
}
async function tensorToImageData(tf, t, size) {
	const rgb01 = tf.tidy(() => t.clipByValue(-1, 1).add(1).div(2));
	const data = await rgb01.data();
	rgb01.dispose();
	return rgbToImageData(Float32Array.from(data), size);
}
async function disposeModel() {
	if (model) {
		model.dispose();
		model = null;
	}
	if (tfMod) {
		try {
			await tfMod.io.removeModel(MODEL_KEY);
		} catch {}
		try {
			await tfMod.io.removeModel("indexeddb://kiln-ddpm");
		} catch {}
	}
}
function memoryInfo() {
	if (!tfMod) return {
		numTensors: 0,
		numBytes: 0
	};
	const m = tfMod.memory();
	return {
		numTensors: m.numTensors,
		numBytes: m.numBytes
	};
}
//#endregion
export { memoryInfo as a, setMeta as c, loadWeights as i, stopTraining as l, hasModel as n, probeGpu as o, loadSavedModel as r, sampleDiffusion as s, diffusion_mx_KdMJo_exports as t, trainDiffusion as u };
