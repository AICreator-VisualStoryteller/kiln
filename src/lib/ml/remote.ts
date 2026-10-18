import { createServerFn } from "@tanstack/react-start";
import type { EpochLog, ModelInfo, TrainConfig, WeightDump } from "@/lib/types";
import { clampTrainConfig } from "@/lib/types";
import { rgbToU8, u8ToB64, b64ToU8, u8ToRgb } from "./codec.ts";
import type { RgbSample } from "./diffusion.ts";

export type PackedSample = { rgbB64: string; caption: string };

export type TrainWire = {
  samples: PackedSample[];
  config: TrainConfig;
};

export type TrainWireResult = {
  info: ModelInfo;
  weights: WeightDump;
  logs: EpochLog[];
};

export function pack(samples: RgbSample[]): PackedSample[] {
  return samples.map((s) => {
    if (!s.rgb) throw new Error("sample niet geladen");
    return {
      rgbB64: u8ToB64(rgbToU8(s.rgb)),
      caption: s.caption,
    };
  });
}

export function unpack(samples: PackedSample[]): RgbSample[] {
  return samples.map((s) => ({
    rgb: u8ToRgb(b64ToU8(s.rgbB64)),
    caption: s.caption,
  }));
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function gpuBase(url: string): string {
  return url.replace(/\/$/, "");
}

export async function pingRemote(
  baseUrl: string,
  token?: string,
): Promise<{ ok: boolean; name: string; backend: string; renderer: string }> {
  const url = `${gpuBase(baseUrl)}/health`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GPU-server health ${res.status}`);
  const body = (await res.json()) as {
    ok?: boolean;
    name?: string;
    backend?: string;
    renderer?: string;
  };
  return {
    ok: body.ok !== false,
    name: body.name ?? "gpu-node",
    backend: body.backend ?? "unknown",
    renderer: body.renderer ?? "remote",
  };
}

export async function trainOnRemote(opts: {
  baseUrl: string;
  token?: string;
  samples: RgbSample[];
  config: TrainConfig;
  onEpoch: (log: EpochLog) => void;
  onStatus: (msg: string) => void;
}): Promise<{ info: ModelInfo; weights: WeightDump }> {
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
      config: opts.config,
    } satisfies TrainWire),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GPU-server train ${res.status}: ${text.slice(0, 180)}`);
  }
  const body = (await res.json()) as TrainWireResult;
  for (const log of body.logs ?? []) opts.onEpoch(log);
  return { info: { ...body.info, compute: "remote" }, weights: body.weights };
}

export const gpuHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { getTf, getGpuRenderer } = await import("./diffusion");
  const tf = await getTf();
  const mem = tf.memory();
  return {
    ok: true as const,
    name: "kiln-node-0",
    backend: tf.getBackend(),
    renderer: getGpuRenderer(),
    numTensors: mem.numTensors,
    numBytes: mem.numBytes,
  };
});

export const gpuTrain = createServerFn({ method: "POST" })
  .validator((input: TrainWire) => input)
  .handler(async ({ data }) => {
    const { trainDiffusion } = await import("./diffusion");
    const samples = unpack(data.samples);
    const logs: EpochLog[] = [];
    const result = await trainDiffusion({
      samples,
      config: clampTrainConfig(data.config),
      onEpoch: (log) => logs.push(log),
      onStatus: () => undefined,
    });
    const payload: TrainWireResult = {
      info: { ...result.info, compute: "node" },
      weights: result.weights,
      logs,
    };
    return payload;
  });

export async function trainOnNode(opts: {
  samples: RgbSample[];
  config: TrainConfig;
  onStatus: (msg: string) => void;
}): Promise<TrainWireResult> {
  opts.onStatus("Kiln GPU-node (deze server) reserveren…");
  const result = await gpuTrain({
    data: {
      samples: pack(opts.samples),
      config: opts.config,
    },
  });
  return result;
}

export async function pingNode() {
  return gpuHealth();
}
