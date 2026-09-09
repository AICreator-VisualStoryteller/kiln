import { createFileRoute } from "@tanstack/react-router";
import { gpuJson, gpuOptions } from "@/lib/ml/gpu-http";

export const Route = createFileRoute("/api/gpu/health")({
  server: {
    handlers: {
      OPTIONS: async () => gpuOptions(),
      GET: async () => {
        const { getTf, getGpuRenderer } = await import("@/lib/ml/diffusion");
        const tf = await getTf();
        const mem = tf.memory();
        return gpuJson({
          ok: true,
          name: "kiln-node-0",
          backend: tf.getBackend(),
          renderer: getGpuRenderer(),
          numTensors: mem.numTensors,
          numBytes: mem.numBytes,
        });
      },
    },
  },
});
