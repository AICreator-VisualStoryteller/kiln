import { createFileRoute } from "@tanstack/react-router";
import { gpuJson, gpuOptions } from "@/lib/ml/gpu-http";
import type { TrainWire } from "@/lib/ml/remote";
import { clampTrainConfig } from "@/lib/types";

export const Route = createFileRoute("/api/gpu/train")({
  server: {
    handlers: {
      OPTIONS: async () => gpuOptions(),
      POST: async ({ request }) => {
        let body: TrainWire;
        try {
          body = (await request.json()) as TrainWire;
        } catch {
          return gpuJson({ error: "ongeldige JSON" }, 400);
        }
        if (!body?.samples?.length || !body.config) {
          return gpuJson({ error: "samples en config verplicht" }, 400);
        }
        const { unpack } = await import("@/lib/ml/remote");
        const { trainDiffusion } = await import("@/lib/ml/diffusion");
        const samples = unpack(body.samples);
        const logs: { epoch: number; loss: number; seconds: number }[] = [];
        const config = clampTrainConfig({
          ...body.config,
          epochs: Math.min(Number(body.config.epochs) || 12, 40),
        });
        const result = await trainDiffusion({
          samples,
          config,
          onEpoch: (log) => logs.push(log),
          onStatus: () => undefined,
        });
        return gpuJson({
          info: { ...result.info, compute: "node" },
          weights: result.weights,
          logs,
        });
      },
    },
  },
});
