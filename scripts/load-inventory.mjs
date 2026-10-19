#!/usr/bin/env node
// Loads REAL voucher codes into the encrypted vault until the admin screen exists (Step 3).
// Needs Node 22.18+ (runs the TypeScript helper directly) and these env vars:
//   INVENTORY_ENCRYPTION_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Usage:
//   node scripts/load-inventory.mjs --brand "Brand Name" --denomination 500 --source "INV-2026-001" --file codes.txt [--test] [--dry-run]
// The brand must already exist (create it in the Admin screen). Use --test for sandbox codes; omit it for REAL codes.
// codes.txt: one code per line. Delete the file after loading. Codes are never printed.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { encryptCode, hashCode } from "../src/lib/inventory.server.ts";

const { values } = parseArgs({
  options: {
    brand: { type: "string" },
    denomination: { type: "string" },
    source: { type: "string" },
    file: { type: "string" },
    "dry-run": { type: "boolean" },
    test: { type: "boolean" },
  },
});
const { brand, denomination, source, file } = values;
const denom = Number(denomination);
if (!brand || !file || !Number.isInteger(denom) || denom <= 0) {
  console.error('Usage: node scripts/load-inventory.mjs --brand "Name" --denomination 500 --file codes.txt [--source "INV-1"] [--dry-run]');
  process.exit(1);
}
const codes = [...new Set(readFileSync(file, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
if (codes.length === 0 || codes.some((c) => c.length < 4 || c.length > 128)) {
  console.error("Every code must be 4 to 128 characters, and the file must not be empty.");
  process.exit(1);
}
const rows = codes.map((code) => ({
  brand,
  denomination: denom,
  code_ciphertext: encryptCode(code),
  code_hash: hashCode(code),
  is_test: values.test === true,
  ...(source ? { source } : {}),
}));

if (values["dry-run"]) {
  console.log(`Dry run OK: ${rows.length} unique ${values.test ? "TEST" : "REAL"} codes for ${brand} at ${denom}. Nothing was written.`);
  process.exit(0);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(url, key, { auth: { persistSession: false } });
let added = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { data, error } = await sb
    .from("gift_card_inventory")
    .upsert(rows.slice(i, i + 500), { onConflict: "code_hash", ignoreDuplicates: true })
    .select("id");
  if (error) { console.error("Upload failed:", error.message); process.exit(1); }
  added += data.length;
}
console.log(`Added ${added} codes, skipped ${rows.length - added} duplicates.`);
