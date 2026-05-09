/**
 * Creates seed test users in Supabase Auth (using the service role key).
 *
 *   npm run db:test-users -- create
 *   npm run db:test-users -- delete
 *
 * Designed for local dev. The default password is "Test1234!" and emails
 * follow the pattern test1@workoutapp.local, test2@..., etc.
 *
 * Note: when email confirmation is on in your Supabase project,
 * createUser({ email_confirm: true }) bypasses the email step so the
 * accounts are immediately usable.
 */

import { config as loadEnv } from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

loadEnv({ path: ".env.local" });
loadEnv();

const TEST_USERS = [
  { email: "test1@workoutapp.local", password: "Test1234!" },
  { email: "test2@workoutapp.local", password: "Test1234!" },
  { email: "test3@workoutapp.local", password: "Test1234!" },
];

async function create() {
  const admin = createAdminClient();
  for (const u of TEST_USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) {
      // "already registered" / "User already exists" are expected on re-runs.
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        console.log(`✓ ${u.email} (already exists)`);
        continue;
      }
      console.error(`✗ ${u.email}: ${error.message}`);
      continue;
    }
    console.log(`✓ ${u.email} (id=${data.user?.id})`);
  }
}

async function destroy() {
  const admin = createAdminClient();
  // Look up by email and delete.
  const { data: list } = await admin.auth.admin.listUsers();
  for (const u of TEST_USERS) {
    const target = list?.users.find((x) => x.email === u.email);
    if (!target) {
      console.log(`· ${u.email} (not found)`);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(target.id);
    if (error) {
      console.error(`✗ ${u.email}: ${error.message}`);
    } else {
      console.log(`✓ ${u.email} (deleted)`);
    }
  }
}

const cmd = process.argv[2] ?? "create";

(cmd === "delete" ? destroy() : create()).catch((err) => {
  console.error(err);
  process.exit(1);
});
