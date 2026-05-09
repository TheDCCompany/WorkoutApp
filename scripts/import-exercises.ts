import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

loadEnv({ path: ".env.local" });
loadEnv();

type RawRow = Record<string, unknown>;

const ALLOWED_PRIMARY_GROUPS = new Set([
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Full Body",
]);

const ALLOWED_TIERS = new Set(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);

function splitList(input: unknown): string[] {
  if (input == null) return [];
  const str = String(input).trim();
  if (!str) return [];
  return str
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(input: unknown): boolean {
  if (typeof input === "boolean") return input;
  if (input == null) return false;
  const s = String(input).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

function num(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected numeric value, got: ${JSON.stringify(input)}`);
  }
  return n;
}

function tierNum(input: unknown): number {
  const s = String(input ?? "").trim();
  if (!ALLOWED_TIERS.has(s)) throw new Error(`Bad tier: ${s}`);
  return Number(s.split(" ")[1]);
}

function modeLower(input: unknown): "standard" | "bodyweight" | "both" {
  const s = String(input ?? "").trim().toLowerCase();
  if (s !== "standard" && s !== "bodyweight" && s !== "both") {
    throw new Error(`Bad workout_mode: ${input}`);
  }
  return s;
}

function compoundOrIso(input: unknown): "Compound" | "Isolation" {
  const s = String(input ?? "").trim();
  if (s !== "Compound" && s !== "Isolation") {
    throw new Error(`Bad compound_or_isolation: ${input}`);
  }
  return s;
}

function loadRowsFromXlsx(path: string): RawRow[] {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets["Exercise Library"];
  if (!ws) throw new Error("Sheet 'Exercise Library' not found in xlsx");
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  // Header row sits at index 3 in the MVP spreadsheet (banner + version + blank).
  const headers = raw[3] as string[];
  const dataRows = raw.slice(4) as unknown[][];

  return dataRows
    .filter((row) => row.length > 0 && row[0] != null && String(row[0]).trim())
    .map((row) => {
      const obj: RawRow = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i];
      });
      return obj;
    });
}

function loadRowsFromCsv(path: string): RawRow[] {
  const wb = XLSX.readFile(path, { type: "file", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(ws);
}

interface NormalizedRow {
  id: string;
  exercise_name: string;
  slug: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  movement_pattern: string | null;
  equipment_type: string;
  bodyweight_compatible: boolean;
  workout_mode: "standard" | "bodyweight" | "both";
  compound_or_isolation: "Compound" | "Isolation";
  unilateral: boolean;
  hypertrophy_tier: number;
  fatigue_score_1_10: number;
  axial_fatigue_1_10: number;
  systemic_fatigue_1_10: number;
  setup_complexity_1_10: number;
  stability_requirement_1_10: number;
  progression_type: string;
  recommended_rep_min: number;
  recommended_rep_max: number;
  default_sets_min: number;
  default_sets_max: number;
  default_rest_seconds: number;
  estimated_time_minutes: number;
  beginner_friendly: boolean;
  max_test_eligible: boolean;
  superset_friendly: boolean;
  superset_pairing_preference: string[];
  avoid_superset_with: string[];
  stimulus_to_fatigue_rating: string | null;
  programming_notes: string | null;
}

function normalize(row: RawRow): NormalizedRow {
  const id = String(row.exercise_id ?? "").trim();
  if (!id) throw new Error(`Row missing exercise_id: ${JSON.stringify(row)}`);

  const primary = String(row.primary_muscle_group ?? "").trim();
  if (!ALLOWED_PRIMARY_GROUPS.has(primary)) {
    throw new Error(`Row ${id} has unknown primary_muscle_group: ${primary}`);
  }

  return {
    id,
    exercise_name: String(row.exercise_name ?? "").trim(),
    slug: String(row.slug ?? "").trim(),
    primary_muscle_group: primary,
    secondary_muscle_groups: splitList(row.secondary_muscle_groups),
    movement_pattern: row.movement_pattern ? String(row.movement_pattern) : null,
    equipment_type: String(row.equipment_type ?? "").trim(),
    bodyweight_compatible: bool(row.bodyweight_compatible),
    workout_mode: modeLower(row.workout_mode),
    compound_or_isolation: compoundOrIso(row.compound_or_isolation),
    unilateral: bool(row.unilateral),
    hypertrophy_tier: tierNum(row.hypertrophy_tier),
    fatigue_score_1_10: num(row.fatigue_score_1_10),
    axial_fatigue_1_10: num(row.axial_fatigue_1_10),
    systemic_fatigue_1_10: num(row.systemic_fatigue_1_10),
    setup_complexity_1_10: num(row.setup_complexity_1_10),
    stability_requirement_1_10: num(row.stability_requirement_1_10),
    progression_type: String(row.progression_type ?? "").trim(),
    recommended_rep_min: num(row.recommended_rep_min),
    recommended_rep_max: num(row.recommended_rep_max),
    default_sets_min: num(row.default_sets_min),
    default_sets_max: num(row.default_sets_max),
    default_rest_seconds: num(row.default_rest_seconds),
    estimated_time_minutes: num(row.estimated_time_minutes),
    beginner_friendly: bool(row.beginner_friendly),
    max_test_eligible: bool(row.max_test_eligible),
    superset_friendly: bool(row.superset_friendly),
    superset_pairing_preference: splitList(row.superset_pairing_preference),
    avoid_superset_with: splitList(row.avoid_superset_with),
    stimulus_to_fatigue_rating: row.stimulus_to_fatigue_rating
      ? String(row.stimulus_to_fatigue_rating)
      : null,
    programming_notes: row.programming_notes ? String(row.programming_notes) : null,
  };
}

const UPSERT_SQL = `
insert into public.exercises (
  id, exercise_name, slug, primary_muscle_group, secondary_muscle_groups,
  movement_pattern, equipment_type, bodyweight_compatible, workout_mode,
  compound_or_isolation, unilateral, hypertrophy_tier, fatigue_score_1_10,
  axial_fatigue_1_10, systemic_fatigue_1_10, setup_complexity_1_10,
  stability_requirement_1_10, progression_type, recommended_rep_min,
  recommended_rep_max, default_sets_min, default_sets_max, default_rest_seconds,
  estimated_time_minutes, beginner_friendly, max_test_eligible, superset_friendly,
  superset_pairing_preference, avoid_superset_with, stimulus_to_fatigue_rating,
  programming_notes
) values (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
  $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
)
on conflict (id) do update set
  exercise_name = excluded.exercise_name,
  slug = excluded.slug,
  primary_muscle_group = excluded.primary_muscle_group,
  secondary_muscle_groups = excluded.secondary_muscle_groups,
  movement_pattern = excluded.movement_pattern,
  equipment_type = excluded.equipment_type,
  bodyweight_compatible = excluded.bodyweight_compatible,
  workout_mode = excluded.workout_mode,
  compound_or_isolation = excluded.compound_or_isolation,
  unilateral = excluded.unilateral,
  hypertrophy_tier = excluded.hypertrophy_tier,
  fatigue_score_1_10 = excluded.fatigue_score_1_10,
  axial_fatigue_1_10 = excluded.axial_fatigue_1_10,
  systemic_fatigue_1_10 = excluded.systemic_fatigue_1_10,
  setup_complexity_1_10 = excluded.setup_complexity_1_10,
  stability_requirement_1_10 = excluded.stability_requirement_1_10,
  progression_type = excluded.progression_type,
  recommended_rep_min = excluded.recommended_rep_min,
  recommended_rep_max = excluded.recommended_rep_max,
  default_sets_min = excluded.default_sets_min,
  default_sets_max = excluded.default_sets_max,
  default_rest_seconds = excluded.default_rest_seconds,
  estimated_time_minutes = excluded.estimated_time_minutes,
  beginner_friendly = excluded.beginner_friendly,
  max_test_eligible = excluded.max_test_eligible,
  superset_friendly = excluded.superset_friendly,
  superset_pairing_preference = excluded.superset_pairing_preference,
  avoid_superset_with = excluded.avoid_superset_with,
  stimulus_to_fatigue_rating = excluded.stimulus_to_fatigue_rating,
  programming_notes = excluded.programming_notes
`;

async function main() {
  const inputArg = process.argv[2] ?? "hypertrophy_exercise_library_mvp.xlsx";
  const path = join(process.cwd(), inputArg);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);

  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL not set in .env.local");

  const ext = path.toLowerCase().split(".").pop();
  const rows =
    ext === "csv" ? loadRowsFromCsv(path) : loadRowsFromXlsx(path);

  console.log(`Read ${rows.length} rows from ${inputArg}`);

  const normalized: NormalizedRow[] = [];
  for (const row of rows) {
    try {
      normalized.push(normalize(row));
    } catch (err) {
      console.error(`Skipping row: ${(err as Error).message}`);
    }
  }
  console.log(`${normalized.length} rows ready to upsert`);

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("begin");
    for (const r of normalized) {
      await client.query(UPSERT_SQL, [
        r.id,
        r.exercise_name,
        r.slug,
        r.primary_muscle_group,
        r.secondary_muscle_groups,
        r.movement_pattern,
        r.equipment_type,
        r.bodyweight_compatible,
        r.workout_mode,
        r.compound_or_isolation,
        r.unilateral,
        r.hypertrophy_tier,
        r.fatigue_score_1_10,
        r.axial_fatigue_1_10,
        r.systemic_fatigue_1_10,
        r.setup_complexity_1_10,
        r.stability_requirement_1_10,
        r.progression_type,
        r.recommended_rep_min,
        r.recommended_rep_max,
        r.default_sets_min,
        r.default_sets_max,
        r.default_rest_seconds,
        r.estimated_time_minutes,
        r.beginner_friendly,
        r.max_test_eligible,
        r.superset_friendly,
        r.superset_pairing_preference,
        r.avoid_superset_with,
        r.stimulus_to_fatigue_rating,
        r.programming_notes,
      ]);
    }
    await client.query("commit");
    const c = await client.query<{ count: string }>(
      "select count(*) from public.exercises"
    );
    console.log(`Upserted ${normalized.length} exercises. Total in table: ${c.rows[0].count}`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
