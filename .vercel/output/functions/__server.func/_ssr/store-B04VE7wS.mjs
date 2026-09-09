import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-B04VE7wS.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1048576).toFixed(1)} MB`;
}
function formatLoss(n) {
	if (!Number.isFinite(n)) return "—";
	return n >= 10 ? n.toFixed(2) : n.toFixed(3);
}
var DEFAULT_TRAIN_CONFIG = {
	epochs: 48,
	batchSize: 8,
	learningRate: .001,
	imageSize: 16,
	timesteps: 40
};
var DEFAULT_COMPUTE = {
	mode: "local",
	remoteUrl: "",
	remoteToken: ""
};
var DB_NAME = "kiln";
var DB_VERSION = 2;
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
			if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
			if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function txDone(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}
function asImage(raw) {
	return {
		id: raw.id,
		caption: typeof raw.caption === "string" ? raw.caption : "",
		name: raw.name,
		createdAt: raw.createdAt
	};
}
async function loadAll() {
	const tx = (await openDb()).transaction([
		"images",
		"blobs",
		"meta"
	], "readonly");
	const imagesStore = tx.objectStore("images");
	const blobsStore = tx.objectStore("blobs");
	const metaStore = tx.objectStore("meta");
	const rawImages = await reqToPromise(imagesStore.getAll());
	const blobKeys = await reqToPromise(blobsStore.getAllKeys());
	const blobs = {};
	for (const key of blobKeys) {
		const blob = await reqToPromise(blobsStore.get(key));
		if (blob) blobs[String(key)] = blob;
	}
	const config = await reqToPromise(metaStore.get("config")) ?? DEFAULT_TRAIN_CONFIG;
	const compute = await reqToPromise(metaStore.get("compute")) ?? DEFAULT_COMPUTE;
	const modelInfo = await reqToPromise(metaStore.get("modelInfo")) ?? null;
	await txDone(tx);
	return {
		images: (rawImages ?? []).map(asImage),
		blobs,
		config: {
			...DEFAULT_TRAIN_CONFIG,
			...config,
			imageSize: config.imageSize === 16 || config.imageSize === 32 || config.imageSize === 48 ? config.imageSize : 16
		},
		compute: {
			...DEFAULT_COMPUTE,
			...compute
		},
		modelInfo
	};
}
async function saveConfig(config) {
	const tx = (await openDb()).transaction("meta", "readwrite");
	tx.objectStore("meta").put(config, "config");
	await txDone(tx);
}
async function saveCompute(compute) {
	const tx = (await openDb()).transaction("meta", "readwrite");
	tx.objectStore("meta").put(compute, "compute");
	await txDone(tx);
}
async function saveModelInfo(info) {
	const tx = (await openDb()).transaction("meta", "readwrite");
	tx.objectStore("meta").put(info, "modelInfo");
	await txDone(tx);
}
async function putImages(items) {
	const tx = (await openDb()).transaction(["images", "blobs"], "readwrite");
	const images = tx.objectStore("images");
	const blobs = tx.objectStore("blobs");
	for (const item of items) {
		images.put(item.record);
		blobs.put(item.blob, item.record.id);
	}
	await txDone(tx);
}
async function deleteImage(id) {
	const tx = (await openDb()).transaction(["images", "blobs"], "readwrite");
	tx.objectStore("images").delete(id);
	tx.objectStore("blobs").delete(id);
	await txDone(tx);
}
async function updateImage(record) {
	const tx = (await openDb()).transaction("images", "readwrite");
	tx.objectStore("images").put(record);
	await txDone(tx);
}
async function clearAll() {
	const tx = (await openDb()).transaction([
		"images",
		"blobs",
		"meta"
	], "readwrite");
	tx.objectStore("images").clear();
	tx.objectStore("blobs").clear();
	tx.objectStore("meta").clear();
	await txDone(tx);
}
function reqToPromise(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function uid() {
	return crypto.randomUUID();
}
function revoke(url) {
	try {
		URL.revokeObjectURL(url);
	} catch {}
}
var useKiln = create((set, get) => ({
	ready: false,
	images: [],
	config: DEFAULT_TRAIN_CONFIG,
	compute: DEFAULT_COMPUTE,
	status: "idle",
	logs: [],
	trainMessage: "",
	jobId: null,
	consoleLines: [],
	prepDone: 0,
	prepTotal: 0,
	gpu: null,
	modelInfo: null,
	modelStale: false,
	hydrate: async () => {
		const data = await loadAll();
		set({
			ready: true,
			images: data.images.map((rec) => ({
				...rec,
				url: data.blobs[rec.id] ? URL.createObjectURL(data.blobs[rec.id]) : ""
			})),
			config: data.config,
			compute: data.compute,
			modelInfo: data.modelInfo,
			modelStale: false
		});
	},
	addImages: async (files) => {
		const items = [];
		const packed = [];
		for (const file of files) {
			const record = {
				id: uid(),
				caption: file.caption,
				name: file.name,
				createdAt: Date.now()
			};
			packed.push({
				record,
				blob: file.blob
			});
			items.push({
				...record,
				url: URL.createObjectURL(file.blob)
			});
		}
		await putImages(packed);
		set({
			images: [...get().images, ...items],
			modelStale: get().modelInfo !== null
		});
	},
	setImageCaption: async (id, caption) => {
		const images = get().images.map((im) => im.id === id ? {
			...im,
			caption
		} : im);
		const found = images.find((im) => im.id === id);
		if (found) await updateImage(found);
		set({
			images,
			modelStale: get().modelInfo !== null
		});
	},
	removeImage: async (id) => {
		const found = get().images.find((im) => im.id === id);
		if (found) revoke(found.url);
		await deleteImage(id);
		set({
			images: get().images.filter((im) => im.id !== id),
			modelStale: get().modelInfo !== null
		});
	},
	setConfig: async (patch) => {
		const config = {
			...get().config,
			...patch
		};
		await saveConfig(config);
		set({ config });
	},
	setCompute: async (patch) => {
		const compute = {
			...get().compute,
			...patch
		};
		await saveCompute(compute);
		set({ compute });
	},
	setStatus: (status) => set({ status }),
	setTrainMessage: (trainMessage) => set({ trainMessage }),
	pushLog: (log) => set({ logs: [...get().logs, log] }),
	beginJob: (id) => set({
		jobId: id,
		logs: [],
		consoleLines: [`${id}  submitted`],
		prepDone: 0,
		prepTotal: 0,
		trainMessage: "Job starten…",
		status: "loading"
	}),
	pushConsole: (line) => set({ consoleLines: [...get().consoleLines, line].slice(-80) }),
	setPrep: (done, total) => set({
		prepDone: done,
		prepTotal: total
	}),
	setGpu: (gpu) => set({ gpu }),
	setModelInfo: async (info, stale = false) => {
		await saveModelInfo(info);
		set({
			modelInfo: info,
			modelStale: stale
		});
	},
	resetAll: async () => {
		try {
			const { disposeModel } = await import("./diffusion-mx_KdMJo.mjs").then((n) => n.t).then((n) => n.t);
			await disposeModel();
		} catch {}
		for (const im of get().images) revoke(im.url);
		await clearAll();
		set({
			images: [],
			config: DEFAULT_TRAIN_CONFIG,
			compute: DEFAULT_COMPUTE,
			status: "idle",
			logs: [],
			trainMessage: "",
			jobId: null,
			consoleLines: [],
			prepDone: 0,
			prepTotal: 0,
			modelInfo: null,
			modelStale: false
		});
	}
}));
//#endregion
export { useKiln as i, formatBytes as n, formatLoss as r, cn as t };
