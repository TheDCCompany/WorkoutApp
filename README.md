# Workout App

A daily hypertrophy workout planner. Generates time-boxed, mode-aware workouts
from your selected exercise pool, tracks recovery per muscle group, and
applies progressive overload from your logged history.

- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
  (Auth + Postgres + RLS) · Vitest · Vercel
- **Deterministic:** the workout engine is pure TS — no LLM calls, no
  randomness beyond a stable tiebreak
- **Mobile-first** UI; the engine and types are isolated from browser APIs
  so a future Expo/iOS app can reuse the same backend

---

## Quick start

```bash
# 1. Install
npm install

# 2. Fill in .env.local — see "Environment variables" below
cp .env.example .env.local

# 3. Apply schema + seed the exercise library
npm run db:migrate
npm run db:seed

# (optional) create test users in Supabase Auth
npm run db:test-users

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000 and sign up.

---

## Environment variables

All Supabase credentials live in `.env.local` (gitignored). The same names
must be set in Vercel → Project Settings → Environment Variables for
production.

| Var | Where it's used | Sensitive? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server clients | No (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server clients | No — gated by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin scripts only (import, test users) | **Yes — bypasses RLS** |
| `SUPABASE_DB_URL` | Direct Postgres connection for migrations + seed scripts | **Yes — full DB access** |
| `NEXT_PUBLIC_SITE_URL` | Email-confirmation redirect target after sign-up | No |

Get the Supabase keys from your project's **Project Settings → API**. The
`service_role` key is shown under "Project API Keys → service_role secret".

For Vercel, set `NEXT_PUBLIC_SITE_URL` to your Vercel deploy URL (e.g.
`https://workout-app.vercel.app`), not `localhost:3000`.

---

## Project structure

```
app/                       Next.js App Router routes
├── login/                 Sign-in page + server actions
├── sign-up/
├── auth/callback/         Email-confirmation handler
├── onboarding/            Step 1: pool · Step 2: maxes
├── dashboard/             Today screen + Override
├── workout/[id]/          Logging UI · /done confirmation
└── history/               List + per-workout detail

components/                Reusable UI components
lib/
├── supabase/              Browser, server, and admin clients
├── workout-engine/        Pure deterministic generator (tested)
├── recovery/              Recovery scoring + recommendation (tested)
├── progression/           Progressive overload rules (tested)
├── weight/                Weight recommendation (tested)
└── data/                  Server-side data loaders for the engine

types/                     Domain + database TypeScript types
scripts/                   migrate, import-exercises, create-test-users
supabase/migrations/       SQL migration files (numbered, sequential)
proxy.ts                   Next.js auth proxy (formerly middleware.ts)
```

The pure libs in `lib/workout-engine`, `lib/recovery`, `lib/progression`,
and `lib/weight` have no dependency on Supabase, the browser, or
React. They take plain data inputs and return plain data outputs, so
they're directly reusable from a future Expo/iOS app.

---

## Database

9 tables under `public`, all with Row-Level Security enabled:

- **profiles** — auto-created from `auth.users` via trigger; tracks
  `onboarded_at`
- **exercises** — global library (97 rows seeded from
  `hypertrophy_exercise_library_mvp.xlsx`); read-only for users
- **user_exercise_pool** — composite key `(user_id, exercise_id)`
- **user_exercise_maxes** — optional 1RM per exercise
- **workouts** — one row per generated workout; `completed_at` stamps
  completion
- **workout_exercises** — exercises planned for a workout
- **workout_sets** — planned + actual reps/weights per set
- **muscle_group_recovery** — running per-user recovery state, updated
  on workout completion
- **exercise_performance_history** — per-set log used by the
  progression engine

RLS policies gate every user-data table by `user_id = auth.uid()`. The
`exercises` table is readable by any authenticated user.

### Migrations

Migrations live in `supabase/migrations/` as numbered SQL files. Apply
them with:

```bash
npm run db:migrate
```

The runner records applied files in `app_meta.migrations` so re-running
is idempotent.

---

## How the workout engine decides

Given a user's pool, target muscle groups, available time, and prior
history:

1. **Filter** by workout mode (standard accepts `standard`+`both`;
   bodyweight accepts `bodyweight`+`both`)
2. **Filter** by target muscle groups (`Full Body` falls back to "any
   compound exercise")
3. **Score** each candidate:
   `(100 - tier*10) + recencyBonus + (10 - fatigue)` — tier-1 lifts get
   a head start, exercises not done recently get a recency bonus, lower
   fatigue scores get preference
4. **Select** greedily into the time budget, spreading across multiple
   target groups when more than one is selected
5. **Plan** sets/reps/rest from the exercise's defaults; pick a weight
   via the intensity bands below

**Time bucket → exercise count:**

| Minutes | Count |
|---|---|
| 20 | 2–3 |
| 30 | 3–4 |
| 45 | 4–6 |
| 60 | 5–8 |
| 75 | 6–10 |

**Weight recommendation (when 1RM is known):**

| Top of rep range | %1RM (mid of band) |
|---|---|
| ≤ 8 | 80% (75–85% band) |
| ≤ 12 | 70% (65–75%) |
| ≤ 15 | 60% (55–65%) |
| ≤ 20 | 52.5% (45–60%) |

If no 1RM, the last logged weight for that exercise is used. If neither
is available, the recommendation is left blank ("choose a manageable
weight"). All weights are rounded to the nearest 5 lbs.

**Recovery score:**

```
recovery_score = clamp(0..100, days_since_trained * 25 - fatigue_penalty)
fatigue_penalty = recent_hard_sets * 3 + average_fatigue_score
```

| Score | Band |
|---|---|
| 90–100 | Fully recovered |
| 70–89 | Good to train |
| 50–69 | Train lightly |
| 30–49 | Avoid direct hard work |
| 0–29 | Rest |

**Progressive overload:**

| Performance | Next-session weight |
|---|---|
| All sets at top of range | +2.5% |
| All sets in range | hold |
| 1–2 reps short of bottom | hold |
| ≥3 reps short of bottom | -5% |
| Skipped | no change |

---

## Tests

```bash
npm test           # vitest run
npm run test:watch # vitest in watch mode
```

Tests live alongside the libs (`lib/**.test.ts`) and cover:

- Recovery score calculation + bands
- Recommendation logic (with/without history, pairings, override expansion)
- Weight recommendation + intensity bands + rounding
- Progressive overload rules
- Workout generation end-to-end (filters, mode, time fitting, override)

Currently 40 tests across 4 files.

---

## Scripts reference

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest, run once |
| `npm run db:migrate` | Apply SQL files in `supabase/migrations/` |
| `npm run db:seed` | Import the xlsx exercise library into `exercises` |
| `npm run db:test-users` | Create 3 test users (default password `Test1234!`); pass `-- delete` to remove them |

---

## Deploy

The app is Vercel-ready. Connect the GitHub repo at vercel.com,
copy `.env.local` values into the project's Environment Variables (set
`NEXT_PUBLIC_SITE_URL` to your Vercel domain, not `localhost`), and
every push to `main` redeploys automatically.

---

## What's intentionally NOT in the MVP

- AI coaching / LLM calls
- Nutrition tracking
- Social features
- OAuth providers (email + password only)
- Per-set autosave during a workout — completion submits the whole log
  at once
- Generated TS types from Supabase — hand-written types in
  `types/database.ts` and `types/domain.ts`
