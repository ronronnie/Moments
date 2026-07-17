import { LoadingScreen } from "@/components/LoadingScreen";

// Shown while the interviewer thinks of follow-up questions.
export default function Loading() {
  return (
    <LoadingScreen
      title="Listening to your story…"
      subtitle="Thinking of what to ask next."
    />
  );
}
