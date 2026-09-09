import { l as u8ToRgb, n as b64ToU8 } from "./codec-CNFPhatT.mjs";
import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/remote-TlNVfUfG.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function unpack(samples) {
	return samples.map((s) => ({
		rgb: u8ToRgb(b64ToU8(s.rgbB64)),
		caption: s.caption
	}));
}
var gpuHealth_createServerFn_handler = createServerRpc({
	id: "a2f93827921924a8f1835756a41c60569decefee987a124458b79c7119d18374",
	name: "gpuHealth",
	filename: "src/lib/ml/remote.ts"
}, (opts) => gpuHealth.__executeServer(opts));
var gpuHealth = createServerFn({ method: "GET" }).handler(gpuHealth_createServerFn_handler, async () => {
	const { getTf, getGpuRenderer } = await import("./diffusion-mx_KdMJo.mjs").then((n) => n.t).then((n) => n.t);
	const tf = await getTf();
	const mem = tf.memory();
	return {
		ok: true,
		name: "kiln-node-0",
		backend: tf.getBackend(),
		renderer: getGpuRenderer(),
		numTensors: mem.numTensors,
		numBytes: mem.numBytes
	};
});
var gpuTrain_createServerFn_handler = createServerRpc({
	id: "83f1d7444dff06756aa63398ddfd00384103e2d9d9bb3fd3f6f4c9a3c4205c4e",
	name: "gpuTrain",
	filename: "src/lib/ml/remote.ts"
}, (opts) => gpuTrain.__executeServer(opts));
var gpuTrain = createServerFn({ method: "POST" }).validator((input) => input).handler(gpuTrain_createServerFn_handler, async ({ data }) => {
	const { trainDiffusion } = await import("./diffusion-mx_KdMJo.mjs").then((n) => n.t).then((n) => n.t);
	const samples = unpack(data.samples);
	const logs = [];
	const result = await trainDiffusion({
		samples,
		config: {
			...data.config,
			epochs: Math.min(data.config.epochs, 40)
		},
		onEpoch: (log) => logs.push(log),
		onStatus: () => void 0
	});
	return {
		info: {
			...result.info,
			compute: "node"
		},
		weights: result.weights,
		logs
	};
});
//#endregion
export { gpuHealth_createServerFn_handler, gpuTrain_createServerFn_handler };
