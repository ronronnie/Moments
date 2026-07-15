import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API client for the app's own AI work — the interviewer, context
 * extraction, structuring, and polishing. Spec §7 names Sonnet as the LLM.
 * These are short, structured tasks, so we run with thinking off and low
 * effort for speed, and ask for JSON we parse ourselves.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

let cached: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  cached ??= new Anthropic();
  return cached;
}

/** Pull the first balanced JSON object/array out of a text blob. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.search(/[[{]/);
  if (start === -1) return trimmed;
  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === open) depth++;
    else if (trimmed[i] === close) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed.slice(start);
}

/**
 * Send a system + user prompt and parse the JSON reply into T. Throws on an
 * empty response or unparseable JSON so callers can decide how to degrade.
 */
export async function completeJson<T>(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content.");
  }

  return JSON.parse(extractJson(textBlock.text)) as T;
}
