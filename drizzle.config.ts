import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // EXPORT NOTE: DATABASE_URL added so you can migrate without Lovable.
    // The original read only LOVABLE_DB_MIGRATION_URL (still supported as a fallback).
    url: process.env.DATABASE_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
