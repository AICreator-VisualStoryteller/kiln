#!/usr/bin/env node
/**
 * Kiln GPU-node — zelfde DDPM als de app.
 *
 *   node --experimental-strip-types scripts/kiln-gpu-server.mjs
 *
 * GET  /health
 * POST /train   { samples: [{ rgbB64, caption }], config }
 */
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PORT = Number(process.env.KILN_GPU_PORT || 8765);
const TOKEN = process.env.KILN_GPU_TOKEN || "";
const root = dirname(fileURLToPath(import.meta.url));
const diffUrl = pathToFileURL(join(root, "../src/lib/ml/diffusion.ts")).href;
const codecUrl = pathToFileURL(join(root, "../src/lib/ml/codec.ts")).href;

const { trainDiffusion, probeGpu } = await import(diffUrl);
const { b64ToU8, u8ToRgb } = await import(codecUrl);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function send(res, status, obj) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function authorized(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || "";
  return h === `Bearer ${TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > 40_000_000) {
        reject(new Error("body te groot"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (!authorized(req)) {
    send(res, 401, { error: "unauthorized" });
    return;
  }
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const gpu = await probeGpu();
      send(res, 200, { ok: true, name: "kiln-gpu-server", ...gpu });
      return;
    }
    if (req.method === "POST" && url.pathname === "/train") {
      const body = JSON.parse(await readBody(req));
      const samples = (body.samples || []).map((s) => ({
        rgb: u8ToRgb(b64ToU8(s.rgbB64)),
        caption: String(s.caption || ""),
      }));
      const logs = [];
      const result = await trainDiffusion({
        samples,
        config: body.config,
        onEpoch: (log) => logs.push(log),
        onStatus: (msg) => console.log("[kiln]", msg),
      });
      send(res, 200, {
        info: { ...result.info, compute: "remote" },
        weights: result.weights,
        logs,
      });
      return;
    }
    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : "server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Kiln GPU-node op http://0.0.0.0:${PORT}  (GET /health, POST /train)`);
});
