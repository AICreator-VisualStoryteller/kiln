import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useKiln } from "./store-B04VE7wS.mjs";
import { n as Input, r as Slider, t as Button } from "./slider-D2r91juS.mjs";
import { t as EXAMPLE_PROMPTS } from "./sample-CnfV7EAZ.mjs";
import { a as imageDataToPngBlob, u as upscaleNearest } from "./codec-CNFPhatT.mjs";
import { n as hasModel, r as loadSavedModel, s as sampleDiffusion } from "./diffusion-mx_KdMJo.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as Sparkles } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Badge } from "./badge-Xpy20-29.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lab-2WwFASoq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function GenerateView() {
	const modelInfo = useKiln((s) => s.modelInfo);
	const modelStale = useKiln((s) => s.modelStale);
	const ready = useKiln((s) => s.ready);
	const [prompt, setPrompt] = (0, import_react.useState)(EXAMPLE_PROMPTS[0] ?? "");
	const [steps, setSteps] = (0, import_react.useState)(6);
	const [guidance, setGuidance] = (0, import_react.useState)(1.2);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [stepLabel, setStepLabel] = (0, import_react.useState)("");
	const [shots, setShots] = (0, import_react.useState)([]);
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		return () => {
			for (const s of shots) URL.revokeObjectURL(s.url);
		};
	}, []);
	function paint(data) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const shown = upscaleNearest(data, 256);
		canvas.width = shown.width;
		canvas.height = shown.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		ctx.putImageData(shown, 0, 0);
	}
	async function onGenerate() {
		const p = prompt.trim();
		if (!p) {
			toast.error("Typ een prompt");
			return;
		}
		if (!hasModel()) {
			if (modelInfo) {
				if (!await loadSavedModel(modelInfo.imageSize, modelInfo.timesteps)) {
					toast.error("Gewichten nog niet geladen — train opnieuw");
					return;
				}
			} else {
				toast.error("Nog geen getraind model in geheugen");
				return;
			}
		}
		setBusy(true);
		setStepLabel("ruis…");
		try {
			const frame = await sampleDiffusion({
				prompt: p,
				steps,
				guidance,
				onStep: (img, step, total) => {
					paint(img);
					setStepLabel(`denoise ${step}/${total}`);
				}
			});
			paint(frame);
			const blob = await imageDataToPngBlob(upscaleNearest(frame, 256));
			const url = URL.createObjectURL(blob);
			setShots((prev) => [{
				id: crypto.randomUUID(),
				prompt: p,
				url
			}, ...prev].slice(0, 12));
			setStepLabel("klaar");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Generatie mislukt");
		} finally {
			setBusy(false);
		}
	}
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Studio laden…"
	});
	if (!modelInfo) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-xl space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-medium tracking-tight",
				children: "Genereren"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Train eerst een diffusion-model. Daarna type je een prompt en zie je ruis in stappen een beeld worden — uit jouw gewichten."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/train",
					children: "Naar training"
				})
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-6xl space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-medium tracking-tight",
					children: "Genereren"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 max-w-xl text-sm text-muted-foreground",
					children: [
						"Eerst een grove voorspelling uit ruis, daarna een paar lichte refine-stappen. Intern ",
						modelInfo.imageSize,
						"px, scherp opgeschaald."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [modelStale ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "warning",
						children: "model verouderd"
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						variant: "muted",
						children: [
							modelInfo.imageSize,
							"px · T=",
							modelInfo.timesteps
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "lab-grid flex aspect-square max-h-[28rem] items-center justify-center overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: canvasRef,
							className: "h-full w-full",
							style: { imageRendering: "pixelated" }
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs text-muted-foreground",
						children: stepLabel || "wacht op prompt"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Prompt"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: prompt,
								onChange: (e) => setPrompt(e.target.value),
								placeholder: "een rode cirkel op donkere achtergrond",
								onKeyDown: (e) => {
									if (e.key === "Enter") onGenerate();
								}
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1.5",
							children: EXAMPLE_PROMPTS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setPrompt(p),
								className: "rounded-full bg-elevated px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground",
								children: p
							}, p))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "Refine-stappen"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-xs tabular-nums",
									children: steps
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
								min: 1,
								max: 10,
								step: 1,
								value: [steps],
								disabled: busy,
								onValueChange: ([v]) => setSteps(v ?? 6)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "Guidance"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-xs tabular-nums",
									children: guidance.toFixed(1)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
								min: 1,
								max: 2.5,
								step: .1,
								value: [guidance],
								disabled: busy,
								onValueChange: ([v]) => setGuidance(v ?? 1.2)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							className: "w-full",
							onClick: () => void onGenerate(),
							disabled: busy,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), busy ? "Denoisen…" : "Genereren"]
						})
					]
				})]
			}),
			shots.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium",
					children: "Recente samples"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
					children: shots.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: s.url,
						alt: s.prompt,
						className: "aspect-square w-full rounded-md bg-elevated",
						style: { imageRendering: "pixelated" }
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 truncate text-xs text-muted-foreground",
						children: s.prompt
					})] }, s.id))
				})]
			}) : null
		]
	});
}
function LabPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenerateView, {});
}
//#endregion
export { LabPage as component };
