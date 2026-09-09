import { createFileRoute } from "@tanstack/react-router";
import { GenerateView } from "@/components/generate-view";

export const Route = createFileRoute("/_studio/lab")({
  component: LabPage,
});

function LabPage() {
  return <GenerateView />;
}
