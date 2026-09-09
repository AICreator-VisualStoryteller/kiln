import { i as useKiln } from "./store-B04VE7wS.mjs";
import { r as blobToRgb } from "./codec-CNFPhatT.mjs";
import { a as memoryInfo, i as loadWeights, l as stopTraining, o as probeGpu, u as trainDiffusion } from "./diffusion-mx_KdMJo.mjs";
import { a as trainOnRemote, i as trainOnNode } from "./remote-kxwtknKn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/job-DprN2ZA3.js
function trainReadiness() {
	const { images } = useKiln.getState();
	const n = images.filter((im) => im.caption.trim().length > 0 && im.url).length;
	if (n < 4) return {
		ok: false,
		reason: "Voeg minstens vier afbeeldingen mét bijschrift toe.",
		n
	};
	return {
		ok: true,
		reason: null,
		n
	};
}
async function collectSamples(size) {
	const { images } = useKiln.getState();
	const out = [];
	for (const im of images) {
		const caption = im.caption.trim();
		if (!caption || !im.url) continue;
		const blob = await (await fetch(im.url)).blob();
		const rgb = await blobToRgb(blob, size);
		out.push({
			rgb,
			caption
		});
	}
	return out;
}
async function startTrainJob() {
	const ready = trainReadiness();
	if (!ready.ok) throw new Error(ready.reason ?? "Kan niet trainen");
	const store = useKiln.getState();
	if (store.status === "running" || store.status === "loading") throw new Error("Er draait al een trainingsjob");
	const jobId = `k-${crypto.randomUUID().slice(0, 8)}`;
	store.beginJob(jobId);
	const config = store.config;
	const compute = store.compute;
	const remoteUrl = compute.remoteUrl.trim();
	const useRemote = compute.mode === "remote" && remoteUrl.length > 0;
	const useNode = compute.mode === "node" || compute.mode === "remote" && !remoteUrl;
	store.pushConsole(`compute  ${useRemote ? "remote" : useNode ? "gpu-node" : "local"}`);
	store.pushConsole(`size ${config.imageSize}  T=${config.timesteps}  epochs ${config.epochs}`);
	try {
		store.pushConsole("beelden naar RGB tensors…");
		const samples = await collectSamples(config.imageSize);
		store.pushConsole(`samples  ${samples.length}`);
		store.setStatus("running");
		const onEpoch = (log) => {
			const s = useKiln.getState();
			s.pushLog(log);
			s.pushConsole(`epoch ${String(log.epoch).padStart(2, "0")}  loss ${log.loss.toFixed(4)}  ${log.seconds.toFixed(2)}s`);
			const mem = memoryInfo();
			if (s.gpu) s.setGpu({
				...s.gpu,
				...mem
			});
		};
		const onStatus = (msg) => {
			const s = useKiln.getState();
			s.setTrainMessage(msg);
			s.pushConsole(msg);
		};
		const onBatch = (done, total) => {
			useKiln.getState().setPrep(done, total);
		};
		let info;
		if (useRemote) {
			const result = await trainOnRemote({
				baseUrl: remoteUrl,
				token: compute.remoteToken,
				samples,
				config,
				onEpoch,
				onStatus
			});
			info = result.info;
			await loadWeights(result.weights, config.imageSize, config.timesteps);
		} else if (useNode) {
			const result = await trainOnNode({
				samples,
				config,
				onStatus
			});
			info = result.info;
			await loadWeights(result.weights, config.imageSize, config.timesteps);
			for (const log of result.logs) onEpoch(log);
		} else info = {
			...(await trainDiffusion({
				samples,
				config,
				onEpoch,
				onStatus,
				onBatch
			})).info,
			compute: "local"
		};
		await useKiln.getState().setModelInfo(info, false);
		const done = useKiln.getState();
		done.setStatus("done");
		done.setTrainMessage("Job voltooid — diffusion-gewichten liggen vast.");
		done.pushConsole(`done  loss ${info.finalLoss.toFixed(4)}  ${info.params} params  ${info.backend}`);
		try {
			done.setGpu(await probeGpu());
		} catch {}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Training mislukt";
		useKiln.getState().setStatus("error");
		useKiln.getState().setTrainMessage(msg);
		useKiln.getState().pushConsole(`error  ${msg}`);
		throw err;
	}
}
function requestStop() {
	stopTraining();
	useKiln.getState().setTrainMessage("Stoppen na deze batch…");
	useKiln.getState().pushConsole("stop requested");
}
//#endregion
export { startTrainJob as n, trainReadiness as r, requestStop as t };
