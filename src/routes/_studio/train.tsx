import { createFileRoute } from "@tanstack/react-router";
import { TrainView } from "@/components/train-view";

export const Route = createFileRoute("/_studio/train")({
  component: TrainPage,
});

function TrainPage() {
  return <TrainView />;
}
