export type NamedTensor = {
  name: string;
  shape: number[];
  data: Float32Array;
};

function f32le(data: Float32Array): Uint8Array {
  const out = new Uint8Array(data.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < data.length; i++) view.setFloat32(i * 4, data[i]!, true);
  return out;
}

/** HuggingFace safetensors: 8-byte header size + JSON + raw F32 payloads. */
export function encodeSafetensors(
  tensors: NamedTensor[],
  metadata: Record<string, string> = {},
): Uint8Array {
  if (!tensors.length) throw new Error("Geen tensors om te exporteren");
  const header: Record<string, unknown> = {
    __metadata__: { format: "pt", ...metadata },
  };
  const payloads: Uint8Array[] = [];
  let offset = 0;
  const used = new Set<string>();
  for (const t of tensors) {
    let name = t.name || "tensor";
    if (used.has(name)) {
      let k = 2;
      while (used.has(`${name}_${k}`)) k += 1;
      name = `${name}_${k}`;
    }
    used.add(name);
    const bytes = f32le(t.data);
    header[name] = {
      dtype: "F32",
      shape: t.shape,
      data_offsets: [offset, offset + bytes.byteLength],
    };
    payloads.push(bytes);
    offset += bytes.byteLength;
  }
  let json = JSON.stringify(header);
  const pad = (8 - ((8 + json.length) % 8)) % 8;
  if (pad) json += " ".repeat(pad);
  const headerBytes = new TextEncoder().encode(json);
  const out = new Uint8Array(8 + headerBytes.length + offset);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, BigInt(headerBytes.length), true);
  out.set(headerBytes, 8);
  let o = 8 + headerBytes.length;
  for (const p of payloads) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

export function readSafetensorsHeader(bytes: Uint8Array): {
  metadata: Record<string, string>;
  tensors: { name: string; dtype: string; shape: number[]; begin: number; end: number }[];
} {
  if (bytes.length < 8) throw new Error("ongeldige safetensors");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = Number(view.getBigUint64(0, true));
  const start = 8;
  const end = start + headerLen;
  if (!Number.isFinite(headerLen) || headerLen <= 0 || end > bytes.length) {
    throw new Error("safetensors header kapot");
  }
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end))) as Record<
    string,
    unknown
  >;
  const rawMeta =
    json.__metadata__ && typeof json.__metadata__ === "object"
      ? (json.__metadata__ as Record<string, unknown>)
      : {};
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawMeta)) metadata[k] = String(v);
  const tensors: { name: string; dtype: string; shape: number[]; begin: number; end: number }[] =
    [];
  for (const [name, spec] of Object.entries(json)) {
    if (name === "__metadata__" || !spec || typeof spec !== "object") continue;
    const s = spec as { dtype?: string; shape?: number[]; data_offsets?: number[] };
    tensors.push({
      name,
      dtype: s.dtype ?? "F32",
      shape: s.shape ?? [],
      begin: s.data_offsets?.[0] ?? 0,
      end: s.data_offsets?.[1] ?? 0,
    });
  }
  return { metadata, tensors };
}

export function decodeSafetensors(bytes: Uint8Array): {
  metadata: Record<string, string>;
  tensors: NamedTensor[];
} {
  const { metadata, tensors: specs } = readSafetensorsHeader(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = Number(view.getBigUint64(0, true));
  const dataStart = 8 + headerLen;
  const tensors: NamedTensor[] = [];
  for (const spec of specs) {
    if (spec.dtype !== "F32") {
      throw new Error(`Alleen F32-gewichten worden ondersteund (${spec.name}: ${spec.dtype})`);
    }
    const nbytes = spec.end - spec.begin;
    if (nbytes < 0 || dataStart + spec.end > bytes.length) {
      throw new Error(`tensor ${spec.name} valt buiten het bestand`);
    }
    const count = Math.floor(nbytes / 4);
    const data = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      data[i] = view.getFloat32(dataStart + spec.begin + i * 4, true);
    }
    const numel = spec.shape.reduce((a, b) => a * b, 1);
    if (numel !== count) {
      throw new Error(`tensor ${spec.name}: shape ${spec.shape.join("×")} ≠ ${count} floats`);
    }
    tensors.push({ name: spec.name, shape: spec.shape, data });
  }
  if (!tensors.length) throw new Error("Geen tensors in dit safetensors-bestand");
  return { metadata, tensors };
}

export function triggerDownload(
  bytes: Uint8Array,
  filename: string,
  mime = "application/octet-stream",
): void {
  triggerDownloadBlob(new Blob([new Uint8Array(bytes)], { type: mime }), filename);
}

export function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
