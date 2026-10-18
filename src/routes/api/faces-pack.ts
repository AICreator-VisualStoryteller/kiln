import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

async function readPack(): Promise<Buffer | null> {
  const roots = [process.cwd(), join(process.cwd(), ".."), "/workspace"];
  const rel = [
    "src/assets/faces-pack.bin",
    "public/datasets/faces-pack.bin",
    ".vercel/output/static/datasets/faces-pack.bin",
  ];
  for (const root of roots) {
    for (const file of rel) {
      try {
        return await readFile(join(root, file));
      } catch {
        /* next */
      }
    }
  }
  return null;
}

export const Route = createFileRoute("/api/faces-pack")({
  server: {
    handlers: {
      GET: async () => {
        const buf = await readPack();
        if (!buf || buf.byteLength < 1024) {
          return new Response("facespack ontbreekt", { status: 404 });
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
