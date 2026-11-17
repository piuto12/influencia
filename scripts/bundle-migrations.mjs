// Concatenates supabase/migrations/*.sql (in order) into ONE file for pasting into the Supabase SQL editor of a NEW, EMPTY project.
// Usage: node scripts/bundle-migrations.mjs [out-file]   (default: supabase/.bundle/production-setup.sql, git-ignored)
// Alternative with the CLI: supabase link --project-ref <ref> && supabase db push
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const out = process.argv[2] ?? "supabase/.bundle/production-setup.sql";
mkdirSync(path.dirname(out), { recursive: true });
const body = files.map((f) => `-- ============ ${f} ============\n${readFileSync(path.join(dir, f), "utf8")}`).join("\n");
writeFileSync(out, `-- Influencia schema bundle: ${files.length} migrations. Run ONCE on an empty project, then run supabase/production-seed.sql.\nbegin;\n${body}\ncommit;\n`);
console.log(`${files.length} migrations -> ${out}`);
