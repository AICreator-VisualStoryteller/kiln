export function rgbToU8(rgb: Float32Array): Uint8Array {
  const u8 = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) {
    u8[i] = Math.max(0, Math.min(255, Math.round(rgb[i]! * 255)));
  }
  return u8;
}

export function u8ToRgb(u8: Uint8Array): Float32Array {
  const rgb = new Float32Array(u8.length);
  for (let i = 0; i < u8.length; i++) rgb[i] = (u8[i] ?? 0) / 255;
  return rgb;
}

export function u8ToB64(u8: Uint8Array): string {
  const chunk = 0x8000;
  let s = "";
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function f32ToB64(data: ArrayLike<number>): string {
  const arr = data instanceof Float32Array ? data : Float32Array.from(data);
  return u8ToB64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

export function b64ToF32(b64: string): Float32Array {
  const u8 = b64ToU8(b64);
  return new Float32Array(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / 4));
}

export async function blobToRgb(blob: Blob, size: number): Promise<Float32Array> {
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

function makeImageData(data: Uint8ClampedArray, size: number): ImageData {
  if (typeof ImageData === "undefined") {
    return { data, width: size, height: size } as ImageData;
  }
  return new ImageData(new Uint8ClampedArray(data), size, size);
}

export function rgbToImageData(rgb: Float32Array, size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.max(0, Math.min(255, Math.round((rgb[i * 3] ?? 0) * 255)));
    data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((rgb[i * 3 + 1] ?? 0) * 255)));
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round((rgb[i * 3 + 2] ?? 0) * 255)));
    data[i * 4 + 3] = 255;
  }
  return makeImageData(data, size);
}

/** Mix each pixel toward its 3×3 mean — knocks leftover speckle without inventing shapes. */
export function softenRgb(rgb: Float32Array, size: number, mix = 0.35): Float32Array {
  const out = new Float32Array(rgb.length);
  const m = Math.min(1, Math.max(0, mix));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= size) continue;
          const j = (yy * size + xx) * 3;
          r += rgb[j] ?? 0;
          g += rgb[j + 1] ?? 0;
          b += rgb[j + 2] ?? 0;
          n += 1;
        }
      }
      const i = (y * size + x) * 3;
      const inv = 1 - m;
      out[i] = inv * (rgb[i] ?? 0) + (m * r) / n;
      out[i + 1] = inv * (rgb[i + 1] ?? 0) + (m * g) / n;
      out[i + 2] = inv * (rgb[i + 2] ?? 0) + (m * b) / n;
    }
  }
  return out;
}

export function upscaleNearest(src: ImageData, outSize: number): ImageData {
  const sw = src.width;
  const sh = src.height;
  if (sw === outSize && sh === outSize) return src;
  const data = new Uint8ClampedArray(outSize * outSize * 4);
  for (let y = 0; y < outSize; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / outSize));
    for (let x = 0; x < outSize; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / outSize));
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

export function imageDataToPngBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas niet beschikbaar"));
  ctx.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG maken mislukt"))),
      "image/png",
    );
  });
}
