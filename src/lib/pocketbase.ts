// Mirrors synkra-client-hub's src/lib/pocketbase.ts code pattern (same
// idioms, different PocketBase instance - see ARCHITECTURE.md §1) -
// telemetry calls simplified to console.* since that repo's telemetry.ts
// wasn't available to copy verbatim. Swap those for the real logTelemetry
// import if/when this merges into client-hub.
import PocketBase from "pocketbase";

export const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090";

// Canonical name first (SYNKRA-ARCHITECTURE.md / env rollout), legacy name
// kept as a working fallback so nothing hard-cuts.
const configured =
  (import.meta.env["VITE_SYNKRA_PB_URL"] as string | undefined)?.trim() ||
  (import.meta.env["VITE_POCKETBASE_URL"] as string | undefined)?.trim();

export const POCKETBASE_URL =
  configured && /^https?:\/\//.test(configured)
    ? configured.replace(/\/+$/, "")
    : DEFAULT_POCKETBASE_URL;

export function isMixedContentConfig(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:" && POCKETBASE_URL.startsWith("http://");
}

export function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; isAbort?: boolean; message?: string };
  if (e.isAbort) return false;
  if (e.status === 0) return true;
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(e.message ?? "");
}

export function describeConnectionProblem(): string {
  if (isMixedContentConfig()) {
    return `Cannot reach the Synkra server: this site is served over HTTPS but the API is configured as ${POCKETBASE_URL} (plain HTTP), so the browser blocks the request. The API must be served over HTTPS.`;
  }
  return `Cannot reach the Synkra server at ${POCKETBASE_URL}. It may be offline, unreachable over HTTPS, or not allowing requests from ${
    typeof window === "undefined" ? "this site" : window.location.origin
  } (CORS).`;
}

if (!configured) {
  console.warn(
    `[Synkra Agency Portal] VITE_SYNKRA_PB_URL is not set. Falling back to ${DEFAULT_POCKETBASE_URL}. ` +
      "Set it as a build argument in Coolify. Per ARCHITECTURE.md §1, this should be the dedicated Agency instance, not Client Hub's or web-main's.",
  );
}

export const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

/** Subscribes with a console-logged failure path (swap for real telemetry later). */
export async function safeSubscribe(
  collection: string,
  topic: string,
  callback: (event: { action: string; record: Record<string, unknown> }) => void,
): Promise<() => void> {
  try {
    await pb.collection(collection).subscribe(topic, callback as never);
  } catch (err) {
    console.error(`[Synkra Agency Portal] Subscription to ${collection} failed`, err);
  }
  return () => {
    void pb.collection(collection).unsubscribe(topic).catch((err: unknown) => {
      console.warn(`[Synkra Agency Portal] Unsubscribe from ${collection} failed`, err);
    });
  };
}

export default pb;
