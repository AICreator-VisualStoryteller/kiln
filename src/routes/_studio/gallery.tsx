import { createFileRoute } from "@tanstack/react-router";
import { GalleryView } from "@/components/gallery-view";

export const Route = createFileRoute("/_studio/gallery")({
  component: GalleryPage,
});

function GalleryPage() {
  return <GalleryView />;
}
