import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio-shell";

export const Route = createFileRoute("/_studio")({
  component: StudioLayout,
});

function StudioLayout() {
  return (
    <StudioShell>
      <Outlet />
    </StudioShell>
  );
}
