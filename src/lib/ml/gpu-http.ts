export const GPU_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function gpuJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: GPU_CORS });
}

export function gpuOptions(): Response {
  return new Response(null, { status: 204, headers: GPU_CORS });
}
