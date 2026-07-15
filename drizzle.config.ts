import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load DATABASE_URL from .env.local for CLI commands (generate/migrate/push).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
