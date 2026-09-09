import { o as __toESM } from "../_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as useKiln, n as formatBytes, r as formatLoss, t as cn } from "./store-B04VE7wS.mjs";
import { n as Input, r as Slider, t as Button } from "./slider-D2r91juS.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as pingRemote, t as pingNode } from "./remote-kxwtknKn.mjs";
import { n as startTrainJob, r as trainReadiness, t as requestStop } from "./job-DprN2ZA3.mjs";
import { o as Square, t as Zap } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Badge } from "./badge-Xpy20-29.mjs";
import { a as CartesianGrid, i as Line, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as LineChart } from "../_libs/recharts+[...].mjs";
import { n as Root, t as Indicator } from "../_libs/radix-ui__react-progress.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/train-CBA9Sz3A.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Progress({ className, value, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		className: cn("relative h-1.5 w-full overflow-hidden rounded-full bg-elevated", className),
		value,
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Indicator, {
			className: "h-full bg-accent transition-[transform] duration-300 ease-out",
			style: { transform: `translateX(-${100 - (value ?? 0)}%)` }
		})
	});
}
var LR_STEPS = [
	5e-4,
	.001,
	.002
];
function TrainView() {
	const config = useKiln((s) => s.config);
	const setConfig = useKiln((s) => s.setConfig);
	const compute = useKiln((s) => s.compute);
	const setCompute = useKiln((s) => s.setCompute);
	const status = useKiln((s) => s.status);
	const logs = useKiln((s) => s.logs);
	const trainMessage = useKiln((s) => s.trainMessage);
	const consoleLines = useKiln((s) => s.consoleLines);
	const jobId = useKiln((s) => s.jobId);
	const prepDone = useKiln((s) => s.prepDone);
	const prepTotal = useKiln((s) => s.prepTotal);
	const modelInfo = useKiln((s) => s.modelInfo);
	const modelStale = useKiln((s) => s.modelStale);
	const images = useKiln((s) => s.images);
	const ready = useKiln((s) => s.ready);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [pingMsg, setPingMsg] = (0, import_react.useState)(null);
	const check = trainReadiness();
	const running = status === "running" || status === "loading";
	const last = logs[logs.length - 1];
	const progress = running && prepTotal > 0 ? Math.round(prepDone / prepTotal * 100) : running && config.epochs > 0 ? Math.round((last?.epoch ?? 0) / config.epochs * 100) : status === "done" ? 100 : 0;
	const chartData = (0, import_react.useMemo)(() => logs.map((l) => ({
		epoch: l.epoch,
		loss: Number(l.loss.toFixed(4))
	})), [logs]);
	async function onStart() {
		setBusy(true);
		try {
			await startTrainJob();
			toast.success("Training voltooid");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Training mislukt");
		} finally {
			setBusy(false);
		}
	}
	async function onPing() {
		setPingMsg("testen…");
		try {
			if (compute.mode === "local") setPingMsg("lokaal — geen ping nodig");
			else if (compute.remoteUrl.trim()) {
				const h = await pingRemote(compute.remoteUrl, compute.remoteToken);
				setPingMsg(`${h.name} · ${h.backend} · ${h.renderer}`);
			} else {
				const h = await pingNode();
				setPingMsg(`${h.name} · ${h.backend} · ${h.renderer}`);
			}
		} catch (err) {
			setPingMsg(err instanceof Error ? err.message : "geen verbinding");
		}
	}
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Studio laden…"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-6xl space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-medium tracking-tight",
					children: "Training"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-muted-foreground",
					children: "Een conditioneel DDPM (U-Net) leert ruis te voorspellen, geconditioneerd op jouw bijschriften. Cosine-schedule, echte backpropagation."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "secondary",
						onClick: requestStop,
						disabled: compute.mode !== "local",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4" }), "Stop"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => void onStart(),
						disabled: !check.ok || busy,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" }), modelInfo ? "Opnieuw trainen" : "Job starten"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GpuNode, { jobId }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium",
						children: "Compute"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: [["local", "Lokaal (deze browser)"], ["remote", "GPU-server"]].map(([mode, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: running,
							onClick: () => void setCompute({ mode }),
							className: cn("h-11 rounded-md px-3 text-sm", compute.mode === mode || mode === "remote" && compute.mode === "node" ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground hover:text-foreground"),
							children: label
						}, mode))
					}),
					compute.mode === "local" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Training draait hier, op de WebGL-GPU van dit apparaat. Echte backpropagation — aanbevolen."
					}) : null,
					compute.mode === "remote" || compute.mode === "node" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted-foreground",
								children: [
									"Leeg = deze Kiln-node (",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono",
										children: "/api/gpu"
									}),
									"). Of plak de URL van een eigen node: GET /health, POST /train."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: compute.remoteUrl,
								disabled: running,
								placeholder: "http://127.0.0.1:8765",
								onChange: (e) => void setCompute({ remoteUrl: e.target.value })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: compute.remoteToken,
								disabled: running,
								placeholder: "Bearer-token (optioneel)",
								onChange: (e) => void setCompute({ remoteToken: e.target.value })
							})
						]
					}) : null,
					compute.mode !== "local" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "secondary",
							size: "sm",
							onClick: () => void onPing(),
							disabled: running,
							children: "Test verbinding"
						}), pingMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-muted-foreground",
							children: pingMsg
						}) : null]
					}) : null
				]
			}),
			running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: trainMessage
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tabular-nums text-muted-foreground",
						children: last ? `epoch ${last.epoch}/${config.epochs}` : "voorbereiden"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, { value: progress })]
			}) : trainMessage && status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-destructive",
				children: trainMessage
			}) : null,
			!check.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-base font-medium",
						children: "Nog niet klaar om te trainen"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: check.reason
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						className: "mt-5",
						variant: "secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							children: "Naar dataset"
						})
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-6 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium",
							children: "DDPM-config"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Epochs",
							value: String(config.epochs),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
								min: 16,
								max: 80,
								step: 1,
								value: [config.epochs],
								disabled: running,
								onValueChange: ([v]) => void setConfig({ epochs: v ?? 48 })
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Leer-tempo",
							value: String(config.learningRate),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChipRow, {
								disabled: running,
								options: LR_STEPS.map((v) => ({
									value: String(v),
									label: String(v)
								})),
								current: String(config.learningRate),
								onPick: (v) => void setConfig({ learningRate: Number(v) })
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Beeldmaat",
							value: `${config.imageSize}px`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChipRow, {
								disabled: running,
								options: [{
									value: "16",
									label: "16"
								}, {
									value: "32",
									label: "32"
								}],
								current: String(config.imageSize),
								onPick: (v) => void setConfig({ imageSize: Number(v) })
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Timesteps T",
							value: String(config.timesteps),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChipRow, {
								disabled: running,
								options: [
									{
										value: "32",
										label: "32"
									},
									{
										value: "40",
										label: "40"
									},
									{
										value: "56",
										label: "56"
									}
								],
								current: String(config.timesteps),
								onPick: (v) => void setConfig({ timesteps: Number(v) })
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Batch",
							value: String(config.batchSize),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChipRow, {
								disabled: running,
								options: [{
									value: "4",
									label: "4"
								}, {
									value: "8",
									label: "8"
								}],
								current: String(config.batchSize),
								onPick: (v) => void setConfig({ batchSize: Number(v) })
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-muted-foreground",
							children: [images.filter((im) => im.caption.trim()).length, " captioned beelden"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArchitectureTiny, {})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-6",
					children: [
						consoleLines.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mb-3 text-sm font-medium",
								children: "Node-console"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "max-h-40 overflow-auto font-mono text-micro leading-relaxed text-muted-foreground",
								children: consoleLines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: line }, `${i}-${line}`))
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-medium",
									children: "Noise-prediction loss"
								}), last ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-xs tabular-nums text-muted-foreground",
									children: ["mse ", formatLoss(last.loss)]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "wacht op epochs"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-56",
								children: chartData.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
									width: "100%",
									height: "100%",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
										data: chartData,
										margin: {
											top: 8,
											right: 8,
											left: 0,
											bottom: 0
										},
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, { stroke: "color-mix(in oklab, var(--color-foreground) 8%, transparent)" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
												dataKey: "epoch",
												tick: {
													fill: "var(--color-muted-foreground)",
													fontSize: 11
												},
												axisLine: false,
												tickLine: false
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
												tick: {
													fill: "var(--color-muted-foreground)",
													fontSize: 11
												},
												axisLine: false,
												tickLine: false,
												width: 40
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
												background: "var(--color-elevated)",
												border: "1px solid var(--color-border)",
												borderRadius: 8,
												fontSize: 12
											} }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
												type: "monotone",
												dataKey: "loss",
												stroke: "var(--color-accent)",
												dot: false,
												strokeWidth: 1.75,
												isAnimationActive: false
											})
										]
									})
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "lab-grid flex h-full items-center justify-center rounded-lg",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted-foreground",
										children: "Start een job om de curve te zien"
									})
								})
							})]
						}),
						modelInfo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-surface p-5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-3 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-sm font-medium",
										children: "Getraind DDPM"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: modelStale ? "warning" : "success",
										children: modelStale ? "verouderd t.o.v. data" : "klaar"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
									className: "grid grid-cols-2 gap-3 text-sm sm:grid-cols-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											k: "Parameters",
											v: modelInfo.params.toLocaleString("nl-NL")
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											k: "Loss",
											v: formatLoss(modelInfo.finalLoss)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											k: "Backend",
											v: modelInfo.backend
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
											k: "Compute",
											v: modelInfo.compute
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									variant: "secondary",
									className: "mt-4",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/lab",
										children: "Beelden genereren"
									})
								})
							]
						}) : null
					]
				})]
			})
		]
	});
}
function GpuNode({ jobId }) {
	const gpu = useKiln((s) => s.gpu);
	const status = useKiln((s) => s.status);
	const compute = useKiln((s) => s.compute);
	const live = status === "running" || status === "loading";
	const name = compute.mode === "local" ? "kiln-gpu-0" : compute.remoteUrl.trim() ? "remote-gpu" : "kiln-node-0";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] sm:flex-row sm:items-center sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", live ? "gpu-live bg-accent" : "bg-muted-foreground/40") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md truncate text-xs text-muted-foreground",
				children: gpu?.renderer ?? "GPU detecteren…"
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["backend ", gpu?.backend ?? "—"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["tensors ", gpu?.numTensors ?? 0] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatBytes(gpu?.numBytes ?? 0) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: jobId ?? "idle" })
			]
		})]
	});
}
function Field({ label, value, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xs tabular-nums",
				children: value
			})]
		}), children]
	});
}
function ChipRow({ options, current, onPick, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-1.5",
		children: options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			disabled,
			onClick: () => onPick(opt.value),
			className: cn("h-9 rounded-md px-2.5 text-xs transition-colors duration-150", current === opt.value ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground hover:text-foreground"),
			children: opt.label
		}, opt.value))
	});
}
function ArchitectureTiny() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-1",
		children: [
			"x+cond",
			"enc 16",
			"enc 32",
			"bot 64",
			"dec 32",
			"dec 16",
			"x0"
		].map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "rounded-md bg-elevated px-2 py-1 font-mono text-xs text-muted-foreground",
			children: name
		}, name))
	});
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "text-xs text-muted-foreground",
		children: k
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: "mt-0.5 font-mono text-sm tabular-nums",
		children: v
	})] });
}
function TrainPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrainView, {});
}
//#endregion
export { TrainPage as component };
