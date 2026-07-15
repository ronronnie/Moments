import type { Word } from "@/db/schema";

export type SegmentStatus =
  | "ready"
  | "uploading"
  | "transcribing"
  | "error";

/** A recording segment as the capture UI holds it (client-serializable). */
export type ClientSegment = {
  id: string; // real recording id, or a temporary id while uploading
  transcriptText: string;
  wordsJson: Word[] | null;
  source: "initial" | "followup";
  durationS: number | null;
  status: SegmentStatus;
  hasAudio: boolean;
};
