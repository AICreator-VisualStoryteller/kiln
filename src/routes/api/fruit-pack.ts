import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

async function readPack(): Promise<Buffer | null> {
  const roots = [process.cwd(), join(process.cwd(), ".."), "/workspace"];
  const rel = [
    "src/assets/fruit-pack.bin",
    "public/datasets/fruit-pack.bin",
    ".vercel/output/static/datasets/fruit-pack.bin",
  ];
  for (const root of roots) {
    for (const file of rel) {
      try {
        return await readFile(join(root, file));
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

export const Route = createFileRoute("/api/fruit-pack")({
  server: {
    handlers: {
      GET: async () => {
        const buf = await readPack();
        if (!buf || buf.byteLength < 1024) {
          return new Response("fruitpack ontbreekt", { status: 404 });
        }
        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "public, max-age=86400",
            "Content-Length": String(buf.byteLength),
          },
        });
      },
    },
  },
});
