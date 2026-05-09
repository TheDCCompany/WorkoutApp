import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function ensureLedger(client: Client) {
  await client.query(`
    create schema if not exists app_meta;
    create table if not exists app_meta.migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedSet(client: Client): Promise<Set<string>> {
  const r = await client.query<{ filename: string }>(
    "select filename from app_meta.migrations"
  );
  return new Set(r.rows.map((row) => row.filename));
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set in .env.local");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureLedger(client);
    const applied = await appliedSet(client);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migrations found.");
      return;
    }

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`→ applying ${file} ...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into app_meta.migrations (filename) values ($1)", [file]);
        await client.query("commit");
        console.log(`✓ ${file}`);
        count++;
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
    console.log(count === 0 ? "Up to date." : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
