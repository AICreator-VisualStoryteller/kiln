import { r as __exportAll } from "../_runtime.mjs";
import { c as u8ToB64, l as u8ToRgb, n as b64ToU8, s as rgbToU8 } from "./codec-CNFPhatT.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/remote-kxwtknKn.js
var remote_kxwtknKn_exports = /* @__PURE__ */ __exportAll({
	a: () => trainOnRemote,
	i: () => trainOnNode,
	n: () => pingRemote,
	r: () => remote_exports,
	t: () => pingNode
});
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var remote_exports = /* @__PURE__ */ __exportAll$1({
	gpuHealth: () => gpuHealth,
	gpuTrain: () => gpuTrain,
	pack: () => pack,
	pingNode: () => pingNode,
	pingRemote: () => pingRemote,
	trainOnNode: () => trainOnNode,
	trainOnRemote: () => trainOnRemote,
	unpack: () => unpack
});
function pack(samples) {
	return samples.map((s) => ({
		rgbB64: u8ToB64(rgbToU8(s.rgb)),
		caption: s.caption
	}));
}
function unpack(samples) {
	return samples.map((s) => ({
		rgb: u8ToRgb(b64ToU8(s.rgbB64)),
		caption: s.caption
	}));
}
function authHeaders(token) {
	const h = { "Content-Type": "application/json" };
	if (token) h.Authorization = `Bearer ${token}`;
	return h;
}
function gpuBase(url) {
	return url.replace(/\/$/, "");
}
async function pingRemote(baseUrl, token) {
	const url = `${gpuBase(baseUrl)}/health`;
	const res = await fetch(url, { headers: authHeaders(token) });
	if (!res.ok) throw new Error(`GPU-server health ${res.status}`);
	const body = await res.json();
	return {
		ok: body.ok !== false,
		name: body.name ?? "gpu-node",
		backend: body.backend ?? "unknown",
		renderer: body.renderer ?? "remote"
	};
}
async function trainOnRemote(opts) {
	const base = opts.baseUrl.trim();
	if (!base) throw new Error("Vul een GPU-server URL in");
	opts.onStatus(`verbinden met ${base}…`);
	await pingRemote(base, opts.token);
	opts.onStatus("job naar GPU-server sturen…");
	const res = await fetch(`${gpuBase(base)}/train`, {
		method: "POST",
		headers: authHeaders(opts.token),
		body: JSON.stringify({
			samples: pack(opts.samples),
			config: opts.config
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GPU-server train ${res.status}: ${text.slice(0, 180)}`);
	}
	const body = await res.json();
	for (const log of body.logs ?? []) opts.onEpoch(log);
	return {
		info: {
			...body.info,
			compute: "remote"
		},
		weights: body.weights
	};
}
var gpuHealth = createServerFn({ method: "GET" }).handler(createSsrRpc("a2f93827921924a8f1835756a41c60569decefee987a124458b79c7119d18374"));
var gpuTrain = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("83f1d7444dff06756aa63398ddfd00384103e2d9d9bb3fd3f6f4c9a3c4205c4e"));
async function trainOnNode(opts) {
	opts.onStatus("Kiln GPU-node (deze server) reserveren…");
	return await gpuTrain({ data: {
		samples: pack(opts.samples),
		config: opts.config
	} });
}
async function pingNode() {
	return gpuHealth();
}
//#endregion
export { trainOnRemote as a, trainOnNode as i, pingRemote as n, remote_kxwtknKn_exports as r, pingNode as t };
