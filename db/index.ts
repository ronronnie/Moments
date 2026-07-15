import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.local.example → .env.local.");
}

// Neon serverless HTTP driver — ideal for Vercel edge/serverless. For long
// interactive transactions later, swap to the WebSocket pool driver.
const rawSql = neon(process.env.DATABASE_URL);

// Neon's free-tier compute suspends when idle; the first query after a wake can
// occasionally throw a network-level "fetch failed" (or time out) rather than
// just being slow. Retry those transient connection failures a couple of times
// with a short backoff so a cold start doesn't surface as an error. Only
// connection-level failures are retried — real SQL errors propagate immediately.
function isTransient(err: unknown): boolean {
  const msg =
    (err instanceof Error ? err.message : String(err)) +
    " " +
    ((err as { cause?: { message?: string } })?.cause?.message ?? "");
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|connect|Connection|terminat/i.test(
    msg,
  );
}

const sql = new Proxy(rawSql, {
  apply(target, thisArg, args: Parameters<NeonQueryFunction<false, false>>) {
    return (async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await Reflect.apply(target, thisArg, args);
        } catch (err) {
          lastErr = err;
          if (!isTransient(err)) throw err;
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      throw lastErr;
    })();
  },
}) as typeof rawSql;

export const db = drizzle(sql, { schema });

export { schema };
