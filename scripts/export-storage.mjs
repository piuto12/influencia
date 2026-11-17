// Downloads every object from the Supabase Storage buckets into a local folder (service role, run locally only).
// Usage: node --env-file=.env.local scripts/export-storage.mjs backups/storage-<stamp>
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dest = process.argv[2] ?? "backups/storage";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function walk(bucket, prefix = "") {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  let n = 0;
  for (const item of data) {
    const p = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) { n += await walk(bucket, p); continue; } // folder
    const { data: blob, error: e2 } = await db.storage.from(bucket).download(p);
    if (e2) { console.error("skip", bucket, p, e2.message); continue; }
    const file = path.join(dest, bucket, p); await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await blob.arrayBuffer()), { mode: 0o600 }); n++;
  }
  return n;
}
const { data: buckets, error } = await db.storage.listBuckets();
if (error) throw error;
for (const b of buckets) console.log(`bucket ${b.id}: ${await walk(b.id)} file(s)`);
console.log("storage export ->", dest);
