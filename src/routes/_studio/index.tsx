import { createFileRoute } from "@tanstack/react-router";
import { DatasetView } from "@/components/dataset-view";

export const Route = createFileRoute("/_studio/")({
  component: DatasetPage,
});

function DatasetPage() {
  return <DatasetView />;
}
