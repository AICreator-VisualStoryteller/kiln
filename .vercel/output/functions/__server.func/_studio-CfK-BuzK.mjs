import { o as __toESM } from "./_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { i as useKiln, t as cn } from "./_ssr/store-B04VE7wS.mjs";
import { c as setMeta, o as probeGpu, r as loadSavedModel } from "./_ssr/diffusion-mx_KdMJo.mjs";
import { d as useRouterState, m as Outlet, v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { d as Flame, m as ChartLine, s as Sparkles, u as Images } from "./_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_studio-CfK-BuzK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		to: "/",
		label: "Data",
		icon: Images
	},
	{
		to: "/train",
		label: "Trainen",
		icon: ChartLine
	},
	{
		to: "/lab",
		label: "Genereren",
		icon: Sparkles
	}
];
function StudioShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const hydrate = useKiln((s) => s.hydrate);
	const setGpu = useKiln((s) => s.setGpu);
	const ready = useKiln((s) => s.ready);
	const gpu = useKiln((s) => s.gpu);
	const images = useKiln((s) => s.images);
	const modelInfo = useKiln((s) => s.modelInfo);
	const modelStale = useKiln((s) => s.modelStale);
	const status = useKiln((s) => s.status);
	const jobId = useKiln((s) => s.jobId);
	const compute = useKiln((s) => s.compute);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			await hydrate();
			if (cancelled) return;
			try {
				const info = await probeGpu();
				if (!cancelled) setGpu(info);
			} catch {
				if (!cancelled) setGpu({
					backend: "cpu",
					renderer: "niet beschikbaar",
					numTensors: 0,
					numBytes: 0
				});
			}
			const state = useKiln.getState();
			if (state.modelInfo) {
				if (await loadSavedModel(state.modelInfo.imageSize, state.modelInfo.timesteps)) setMeta(state.modelInfo.imageSize, state.modelInfo.timesteps);
				else if (!cancelled) {
					await state.setModelInfo(null);
					if (state.config.imageSize !== 16) await state.setConfig({
						imageSize: 16,
						epochs: Math.max(state.config.epochs, 40)
					});
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [hydrate, setGpu]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-4 py-6 md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-8 flex items-center gap-2.5 px-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-8 items-center justify-center rounded-md bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-4 text-accent" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium tracking-tight",
							children: "Kiln"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-micro text-muted-foreground",
							children: "text → image"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-1 flex-col gap-1",
						children: NAV.map((item) => {
							const active = pathname === item.to;
							const Icon = item.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: cn("flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150", active ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3 rounded-lg bg-elevated p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Beelden",
								value: String(images.length)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Model",
								value: !modelInfo ? "leeg" : modelStale ? "verouderd" : "DDPM"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Compute",
								value: compute.mode,
								live: status === "running"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "GPU",
								value: gpu?.backend ?? "…"
							}),
							jobId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Job",
								value: jobId
							}) : null
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-center justify-between border-b border-border px-4 py-3 md:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-sm text-muted-foreground",
						children: gpu?.renderer ? gpu.renderer : "GPU-node detecteren…"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden font-mono text-xs text-muted-foreground tabular-nums sm:block",
						children: status === "running" || status === "loading" ? "training" : ready ? "klaar" : "laden"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 md:hidden",
				children: NAV.map((item) => {
					const active = pathname === item.to;
					const Icon = item.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: cn("flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro", active ? "text-foreground" : "text-muted-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
					}, item.to);
				})
			})
		]
	});
}
function Stat({ label, value, live }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-micro text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("font-mono text-micro tabular-nums text-foreground", live && "gpu-live text-accent"),
			children: value
		})]
	});
}
function StudioLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudioShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { StudioLayout as component };
