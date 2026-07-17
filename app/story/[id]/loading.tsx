import { LoadingScreen } from "@/components/LoadingScreen";

// Shown while the story is being structured (Structurer + Polisher run here).
export default function Loading() {
  return (
    <LoadingScreen
      title="Shaping your story…"
      subtitle="Finding where each part begins and ends."
    />
  );
}
