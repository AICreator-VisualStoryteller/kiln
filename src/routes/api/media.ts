import { createFileRoute } from "@tanstack/react-router";

const ALLOW_HOSTS = new Set([
  "images.dog.ceo",
  "cdn2.thecatapi.com",
  "s3.us-west-2.amazonaws.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "cataas.com",
]);

function hostOk(hostname: string): boolean {
  return ALLOW_HOSTS.has(hostname) || [...ALLOW_HOSTS].some((h) => hostname.endsWith(`.${h}`));
}

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw) return new Response("url ontbreekt", { status: 400 });
        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("ongeldige url", { status: 400 });
        }
        if (target.protocol !== "https:" || !hostOk(target.hostname)) {
          return new Response("host niet toegestaan", { status: 400 });
        }
        if (
          target.hostname === "s3.us-west-2.amazonaws.com" &&
          !target.pathname.includes("thecatapi")
        ) {
          return new Response("host niet toegestaan", { status: 400 });
        }
        const res = await fetch(target, {
          headers: { Accept: "image/*" },
          redirect: "follow",
        });
        if (!res.ok) return new Response("foto niet geladen", { status: 502 });
        const type = res.headers.get("content-type") || "image/jpeg";
        if (!type.startsWith("image/")) return new Response("geen afbeelding", { status: 502 });
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 8_000_000) return new Response("te groot", { status: 413 });
        return new Response(buf, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
