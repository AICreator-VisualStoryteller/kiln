import { o as __toESM } from "./_runtime.mjs";
import { c as require_react, s as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { i as useKiln, t as cn } from "./_ssr/store-B04VE7wS.mjs";
import { a as DialogOverlay$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "./_libs/@radix-ui/react-dialog+[...].mjs";
import { n as Input, r as Slider, t as Button } from "./_ssr/slider-D2r91juS.mjs";
import { n as generateSampleSet } from "./_ssr/sample-CnfV7EAZ.mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { r as trainReadiness } from "./_ssr/job-DprN2ZA3.mjs";
import { a as Trash2, c as Shapes, f as Eraser, h as Camera, l as Pencil, n as X, p as Circle, r as Upload, t as Zap } from "./_libs/lucide-react.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { t as Root } from "./_libs/radix-ui__react-label.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_studio-BNwId0yf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
function DialogOverlay({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
		className: cn("fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out", className),
		...props
	});
}
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-4 right-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Sluiten"
			})]
		})]
	})] });
}
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-4 space-y-1", className),
		...props
	});
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("text-base font-medium tracking-tight", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
		className: cn("text-sm text-muted-foreground", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		className: cn("text-xs font-medium text-muted-foreground", className),
		...props
	});
}
var MAX_EDGE = 512;
async function fileToStoredBlob(file) {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		bitmap.close();
		throw new Error("Canvas niet beschikbaar");
	}
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("Kon afbeelding niet opslaan")), "image/jpeg", .88);
	});
}
function grabFrame(video) {
	const size = Math.min(video.videoWidth, video.videoHeight);
	if (!size) return Promise.reject(/* @__PURE__ */ new Error("Camera nog niet klaar"));
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext("2d");
	if (!ctx) return Promise.reject(/* @__PURE__ */ new Error("Canvas niet beschikbaar"));
	const sx = (video.videoWidth - size) / 2;
	const sy = (video.videoHeight - size) / 2;
	ctx.drawImage(video, sx, sy, size, size, 0, 0, 256, 256);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("Frame vastleggen mislukt")), "image/jpeg", .9);
	});
}
function CameraDialog({ open, onOpenChange }) {
	const videoRef = (0, import_react.useRef)(null);
	const streamRef = (0, import_react.useRef)(null);
	const [live, setLive] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [caption, setCaption] = (0, import_react.useState)("");
	const addImages = useKiln((s) => s.addImages);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		let cancelled = false;
		setError(null);
		setLive(false);
		(async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "environment",
						width: { ideal: 640 },
						height: { ideal: 640 }
					},
					audio: false
				});
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				const video = videoRef.current;
				if (video) {
					video.srcObject = stream;
					await video.play();
				}
				setLive(true);
			} catch {
				if (!cancelled) setError("Geen toegang tot de camera.");
			}
		})();
		return () => {
			cancelled = true;
			streamRef.current?.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		};
	}, [open]);
	async function capture(count) {
		const video = videoRef.current;
		const cap = caption.trim();
		if (!video || !cap) {
			toast.error("Vul een bijschrift in");
			return;
		}
		setBusy(true);
		try {
			const packed = [];
			for (let i = 0; i < count; i++) {
				const blob = await fileToStoredBlob(await grabFrame(video));
				packed.push({
					blob,
					name: `cam-${Date.now()}-${i + 1}.jpg`,
					caption: cap
				});
				if (count > 1) await new Promise((r) => setTimeout(r, 280));
			}
			await addImages(packed);
			toast.success(`${packed.length} shot${packed.length === 1 ? "" : "s"} · “${cap}”`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Opname mislukt");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-lg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Camera" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Shots krijgen het bijschrift hieronder." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-hidden rounded-lg bg-elevated",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						playsInline: true,
						muted: true,
						className: "aspect-square w-full object-cover"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "cam-cap",
						children: "Bijschrift"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "cam-cap",
						value: caption,
						onChange: (e) => setCaption(e.target.value),
						placeholder: "een rode cirkel op donkere achtergrond"
					})]
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => void capture(1),
						disabled: !live || busy || !caption.trim(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, { className: "size-4" }), "Vastleggen"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "secondary",
						onClick: () => void capture(6),
						disabled: !live || busy || !caption.trim(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-4" }), "6 shots"]
					})]
				})
			]
		})
	});
}
var SIZE = 256;
var PAPER_DARK = "#1a1b1d";
var PAPER_LIGHT = "#e6e1d8";
var INK_LIGHT = "#ecece8";
var INK_DARK = "#1a1b1d";
function coords(canvas, e) {
	const r = canvas.getBoundingClientRect();
	return {
		x: (e.clientX - r.left) / r.width * canvas.width,
		y: (e.clientY - r.top) / r.height * canvas.height
	};
}
function SketchDialog({ open, onOpenChange }) {
	const canvasRef = (0, import_react.useRef)(null);
	const drawing = (0, import_react.useRef)(false);
	const [paperDark, setPaperDark] = (0, import_react.useState)(true);
	const [stroke, setStroke] = (0, import_react.useState)(10);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [caption, setCaption] = (0, import_react.useState)("");
	const addImages = useKiln((s) => s.addImages);
	function fillPaper() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = paperDark ? PAPER_DARK : PAPER_LIGHT;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const id = requestAnimationFrame(fillPaper);
		return () => cancelAnimationFrame(id);
	}, [open, paperDark]);
	function paint(e, start) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const { x, y } = coords(canvas, e.nativeEvent);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = paperDark ? INK_LIGHT : INK_DARK;
		ctx.lineWidth = stroke;
		if (start) {
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + .01, y);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(x, y);
		}
	}
	async function save() {
		const canvas = canvasRef.current;
		const cap = caption.trim();
		if (!canvas || !cap) {
			toast.error("Vul een bijschrift in");
			return;
		}
		setBusy(true);
		try {
			const blob = await new Promise((resolve, reject) => {
				canvas.toBlob((b) => b ? resolve(b) : reject(/* @__PURE__ */ new Error("Kon tekening niet opslaan")), "image/png");
			});
			await addImages([{
				blob,
				name: `tekening-${Date.now()}.png`,
				caption: cap
			}]);
			toast.success(`Toegevoegd · “${cap}”`);
			fillPaper();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Opslaan mislukt");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Tekenen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Teken een vorm en geef het een bijschrift. Dat paar gaat de dataset in." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					width: SIZE,
					height: SIZE,
					className: "aspect-square w-full touch-none rounded-lg",
					style: { background: paperDark ? PAPER_DARK : PAPER_LIGHT },
					onPointerDown: (e) => {
						e.currentTarget.setPointerCapture(e.pointerId);
						drawing.current = true;
						paint(e, true);
					},
					onPointerMove: (e) => {
						if (!drawing.current) return;
						paint(e, false);
					},
					onPointerUp: () => {
						drawing.current = false;
					},
					onPointerCancel: () => {
						drawing.current = false;
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "sk-cap",
						children: "Bijschrift"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "sk-cap",
						value: caption,
						onChange: (e) => setCaption(e.target.value),
						placeholder: "een groene driehoek op donkere achtergrond"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "w-16 text-xs text-muted-foreground",
						children: "Dikte"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
						min: 3,
						max: 28,
						step: 1,
						value: [stroke],
						onValueChange: ([v]) => setStroke(v ?? 10)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setPaperDark(true),
							className: cn("h-9 rounded-md px-3 text-xs", paperDark ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground"),
							children: "Donker papier"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setPaperDark(false),
							className: cn("h-9 rounded-md px-3 text-xs", !paperDark ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground"),
							children: "Licht papier"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: fillPaper,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eraser, { className: "size-4" }), "Wissen"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => void save(),
					disabled: busy || !caption.trim(),
					className: "w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" }), "Toevoegen aan dataset"]
				})
			]
		})
	});
}
function DatasetView() {
	const images = useKiln((s) => s.images);
	const addImages = useKiln((s) => s.addImages);
	const setImageCaption = useKiln((s) => s.setImageCaption);
	const removeImage = useKiln((s) => s.removeImage);
	const resetAll = useKiln((s) => s.resetAll);
	const ready = useKiln((s) => s.ready);
	const modelInfo = useKiln((s) => s.modelInfo);
	const [camOpen, setCamOpen] = (0, import_react.useState)(false);
	const [sketchOpen, setSketchOpen] = (0, import_react.useState)(false);
	const [resetOpen, setResetOpen] = (0, import_react.useState)(false);
	const [caption, setCaption] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [drag, setDrag] = (0, import_react.useState)(false);
	const inputRef = (0, import_react.useRef)(null);
	const ingest = (0, import_react.useCallback)(async (fileList) => {
		const cap = caption.trim();
		if (!cap) {
			toast.error("Vul eerst een bijschrift in");
			return;
		}
		const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
		if (!files.length) {
			toast.error("Geen afbeeldingen gevonden");
			return;
		}
		setBusy(true);
		try {
			const packed = [];
			for (const file of files) {
				const blob = await fileToStoredBlob(file);
				packed.push({
					blob,
					name: file.name,
					caption: cap
				});
			}
			await addImages(packed);
			toast.success(`${packed.length} beeld${packed.length === 1 ? "" : "en"} · “${cap}”`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload mislukt");
		} finally {
			setBusy(false);
		}
	}, [addImages, caption]);
	async function onSample() {
		setBusy(true);
		try {
			const samples = await generateSampleSet();
			await addImages(samples.map((s) => ({
				blob: s.blob,
				name: s.name,
				caption: s.caption
			})));
			toast.success(`${samples.length} captioned vormen geladen`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Voorbeeld laden mislukt");
		} finally {
			setBusy(false);
		}
	}
	const check = trainReadiness();
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Dataset laden…"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-6xl space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-medium tracking-tight",
					children: "Dataset"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-muted-foreground",
					children: "Elke afbeelding krijgt een bijschrift. Daarop traint het diffusion-model — echte text-to-image, geen classificatie."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "secondary",
					onClick: () => void onSample(),
					disabled: busy,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shapes, { className: "size-4" }), "Voorbeelden"]
				})]
			}),
			check.ok && !modelInfo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm",
					children: [check.n, " captioned beelden — klaar om te trainen."]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/train",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" }), "Start training"]
					})
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				onDragOver: (e) => {
					e.preventDefault();
					setDrag(true);
				},
				onDragLeave: () => setDrag(false),
				onDrop: (e) => {
					e.preventDefault();
					setDrag(false);
					ingest(e.dataTransfer.files);
				},
				className: cn("lab-grid flex min-h-44 flex-col items-center justify-center rounded-xl bg-surface px-6 py-10 text-center", "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]", drag && "shadow-[0_0_0_1px_var(--color-accent)]"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mb-3 size-5 text-muted-foreground" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: "Sleep afbeeldingen hierheen"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-auto mt-4 w-full max-w-md",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: caption,
							onChange: (e) => setCaption(e.target.value),
							placeholder: "bijschrift, bijv. een rode cirkel op donkere achtergrond"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap justify-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "secondary",
								disabled: !caption.trim() || busy,
								onClick: () => inputRef.current?.click(),
								children: "Bestanden"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "secondary",
								onClick: () => setCamOpen(true),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-4" }), "Camera"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "secondary",
								onClick: () => setSketchOpen(true),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" }), "Tekenen"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept: "image/*",
						multiple: true,
						className: "hidden",
						onChange: (e) => {
							if (e.target.files) ingest(e.target.files);
							e.target.value = "";
						}
					})
				]
			}),
			images.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface px-6 py-8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-base font-medium",
						children: "Nog geen beelden"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-lg text-sm text-muted-foreground",
						children: "Laad de voorbeelddataset (gekleurde vormen met Nederlandse bijschriften) of voeg eigen foto’s toe. Het netwerk leert de koppeling tekst → beeld."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						className: "mt-5",
						onClick: () => void onSample(),
						disabled: busy,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shapes, { className: "size-4" }), "Voorbeelddataset laden"]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [images.length, " beelden · bijschrift is de trainingsconditie"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					size: "sm",
					onClick: () => setResetOpen(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Wissen"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: images.map((im) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-elevated p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: im.url,
							alt: im.caption || im.name,
							className: "aspect-square w-full rounded-md object-cover"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-3 h-10",
							value: im.caption,
							onChange: (e) => void setImageCaption(im.id, e.target.value),
							placeholder: "bijschrift"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-2 text-xs text-muted-foreground hover:text-foreground",
							onClick: () => void removeImage(im.id),
							children: "Verwijderen"
						})
					]
				}, im.id))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: resetOpen,
				onOpenChange: setResetOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Alles wissen?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Dataset en het getrainde diffusion-model worden verwijderd." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "secondary",
						className: "flex-1",
						onClick: () => setResetOpen(false),
						children: "Annuleren"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "destructive",
						className: "flex-1",
						onClick: () => {
							resetAll();
							setResetOpen(false);
						},
						children: "Wissen"
					})]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraDialog, {
				open: camOpen,
				onOpenChange: setCamOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SketchDialog, {
				open: sketchOpen,
				onOpenChange: setSketchOpen
			})
		]
	});
}
function DatasetPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DatasetView, {});
}
//#endregion
export { DatasetPage as component };
