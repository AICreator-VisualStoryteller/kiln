//#region node_modules/.nitro/vite/services/ssr/assets/codec-CNFPhatT.js
function rgbToU8(rgb) {
	const u8 = new Uint8Array(rgb.length);
	for (let i = 0; i < rgb.length; i++) u8[i] = Math.max(0, Math.min(255, Math.round(rgb[i] * 255)));
	return u8;
}
function u8ToRgb(u8) {
	const rgb = new Float32Array(u8.length);
	for (let i = 0; i < u8.length; i++) rgb[i] = (u8[i] ?? 0) / 255;
	return rgb;
}
function u8ToB64(u8) {
	const chunk = 32768;
	let s = "";
	for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode(...u8.subarray(i, i + chunk));
	return btoa(s);
}
function b64ToU8(b64) {
	const bin = atob(b64);
	const u8 = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
	return u8;
}
function f32ToB64(data) {
	const arr = data instanceof Float32Array ? data : Float32Array.from(data);
	return u8ToB64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}
function b64ToF32(b64) {
	const u8 = b64ToU8(b64);
	return new Float32Array(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / 4));
}
async function blobToRgb(blob, size) {
	const bitmap = await createImageBitmap(blob);
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		bitmap.close();
		throw new Error("Canvas niet beschikbaar");
	}
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(bitmap, 0, 0, size, size);
	bitmap.close();
	const pixels = ctx.getImageData(0, 0, size, size).data;
	const rgb = new Float32Array(size * size * 3);
	for (let i = 0; i < size * size; i++) {
		rgb[i * 3] = (pixels[i * 4] ?? 0) / 255;
		rgb[i * 3 + 1] = (pixels[i * 4 + 1] ?? 0) / 255;
		rgb[i * 3 + 2] = (pixels[i * 4 + 2] ?? 0) / 255;
	}
	return rgb;
}
function makeImageData(data, size) {
	if (typeof ImageData === "undefined") return {
		data,
		width: size,
		height: size
	};
	return new ImageData(new Uint8ClampedArray(data), size, size);
}
function rgbToImageData(rgb, size) {
	const data = new Uint8ClampedArray(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		data[i * 4] = Math.max(0, Math.min(255, Math.round((rgb[i * 3] ?? 0) * 255)));
		data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((rgb[i * 3 + 1] ?? 0) * 255)));
		data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round((rgb[i * 3 + 2] ?? 0) * 255)));
		data[i * 4 + 3] = 255;
	}
	return makeImageData(data, size);
}
function upscaleNearest(src, outSize) {
	const sw = src.width;
	const sh = src.height;
	if (sw === outSize && sh === outSize) return src;
	const data = new Uint8ClampedArray(outSize * outSize * 4);
	for (let y = 0; y < outSize; y++) {
		const sy = Math.min(sh - 1, Math.floor(y * sh / outSize));
		for (let x = 0; x < outSize; x++) {
			const sx = Math.min(sw - 1, Math.floor(x * sw / outSize));
			const si = (sy * sw + sx) * 4;
			const di = (y * outSize + x) * 4;
			data[di] = src.data[si] ?? 0;
			data[di + 1] = src.data[si + 1] ?? 0;
			data[di + 2] = src.data[si + 2] ?? 0;
			data[di + 3] = 255;
		}
	}
	return makeImageData(data, outSize);
}
function imageDataToPngBlob(data) {
	const canvas = document.createElement("canvas");
	canvas.width = data.width;
	canvas.height = data.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return Promise.reject(/* @__PURE__ */ new Error("Canvas niet beschikbaar"));
	ctx.putImageData(data, 0, 0);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("PNG maken mislukt")), "image/png");
	});
}
//#endregion
export { imageDataToPngBlob as a, u8ToB64 as c, f32ToB64 as i, u8ToRgb as l, b64ToU8 as n, rgbToImageData as o, blobToRgb as r, rgbToU8 as s, b64ToF32 as t, upscaleNearest as u };
