import "server-only";
import type { Word } from "@/db/schema";

/**
 * Deepgram transcription with word-level timestamps (a hard requirement — the
 * experience page syncs captions to these). We hand Deepgram the audio's Blob
 * URL and let it fetch remotely, so we never stream large audio through our own
 * function. Model defaults to nova-2 (spec says "nova").
 */

const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? "nova-2";

type DeepgramWord = {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
};

export type Transcription = { transcript: string; words: Word[] };

export async function transcribeUrl(audioUrl: string): Promise<Transcription> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set.");
  }

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: "true",
    punctuate: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Deepgram request failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  const transcript: string = alt?.transcript ?? "";
  const words: Word[] = (alt?.words ?? []).map((w: DeepgramWord) => ({
    w: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    conf: w.confidence,
  }));

  return { transcript, words };
}
