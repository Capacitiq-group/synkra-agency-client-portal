// Server-side only. Superuser client for webhook handlers and checkout
// initialization - never imported by client components. Mirrors
// web-main's src/integrations/pocketbase/client.server.ts pattern.
import PocketBase from "pocketbase";

let _pbAdmin: PocketBase | undefined;
let _authPromise: Promise<void> | undefined;

function serverUrl(): string {
  const url = process.env["POCKETBASE_URL"];
  if (!url) throw new Error("Missing POCKETBASE_URL environment variable.");
  return url.replace(/\/+$/, "");
}

async function ensureAuth(client: PocketBase): Promise<void> {
  if (client.authStore.isValid) return;
  const email = process.env["POCKETBASE_ADMIN_EMAIL"];
  const password = process.env["POCKETBASE_ADMIN_PASSWORD"];
  if (!email || !password) {
    throw new Error("Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD environment variables.");
  }
  await client.collection("_superusers").authWithPassword(email, password);
}

export async function getPbAdmin(): Promise<PocketBase> {
  if (!_pbAdmin) {
    _pbAdmin = new PocketBase(serverUrl());
    _pbAdmin.autoCancellation(false);
  }
  if (!_authPromise) {
    _authPromise = ensureAuth(_pbAdmin).catch((err) => {
      _authPromise = undefined;
      throw err;
    });
  }
  await _authPromise;
  return _pbAdmin;
}
