import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pb, safeSubscribe } from "@/lib/pocketbase";
import { ADDON_PACKS, USAGE_LABELS, type UsageType } from "@/lib/addonPacks";

export const Route = createFileRoute("/_authed/services/$slug")({
  ssr: false,
  component: ServiceDetailPage,
});

const SERVICE_LABELS: Record<string, string> = {
  "ai-voice-agent": "AI Voice Agent",
  "speed-to-lead": "Speed to Lead",
  "lead-reactivation": "Lead Reactivation",
  "custom-ai-systems": "Custom AI Systems",
};

function ServiceDetailPage() {
  const { slug } = Route.useParams();
  const { agencyClientId } = Route.useRouteContext();

  const [service, setService] = useState<any | null>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<"pause" | "cancel" | null>(null);

  useEffect(() => {
    let unsubEvents: (() => void) | undefined;

    (async () => {
      const svc = await pb
        .collection("agency_client_services")
        .getFirstListItem(
          pb.filter("agency_client_id = {:cid} && service_slug = {:slug}", {
            cid: agencyClientId,
            slug,
          }),
        );
      setService(svc);

      const [creditsResult, eventsResult] = await Promise.all([
        pb.collection("agency_usage_credits").getFullList({
          filter: pb.filter("agency_client_service_id = {:id}", { id: svc.id }),
        }),
        pb.collection("agency_usage_events").getList(1, 20, {
          filter: pb.filter("agency_client_service_id = {:id}", { id: svc.id }),
          sort: "-occurred_at",
        }),
      ]);
      setCredits(creditsResult);
      setRecentEvents(eventsResult.items);

      // Real-time: new usage events for this service append to the top
      // of the list live, no polling. Per ARCHITECTURE.md §6.
      unsubEvents = await safeSubscribe(
        "agency_usage_events",
        `*`,
        (e) => {
          if (e.record["agency_client_service_id"] !== svc.id) return;
          if (e.action === "create") {
            setRecentEvents((prev) => [e.record as any, ...prev].slice(0, 20));
          }
        },
      );
    })();

    return () => {
      unsubEvents?.();
    };
  }, [agencyClientId, slug]);

  async function requestChange(kind: "pause" | "cancel") {
    if (!service) return;
    setBusy(true);
    try {
      const updated = await pb.collection("agency_client_services").update(service.id, {
        pending_change: kind === "pause" ? "pause_at_next_cycle" : "cancel_at_next_cycle",
      });
      setService(updated);
      setConfirmingAction(null);
    } finally {
      setBusy(false);
    }
  }

  async function undoChange() {
    if (!service) return;
    setBusy(true);
    try {
      const updated = await pb.collection("agency_client_services").update(service.id, {
        pending_change: "none",
      });
      setService(updated);
    } finally {
      setBusy(false);
    }
  }

  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  async function buyAddon(usageType: UsageType, quantity: number, priceRand: number) {
    if (!service) return;
    const key = `${usageType}-${quantity}`;
    setBuyingPack(key);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({
          agency_client_service_id: service.id,
          purpose: "addon_purchase",
          addon_usage_type: usageType,
          addon_quantity: quantity,
          amount_rand: priceRand,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch {
      setBuyingPack(null);
      alert("Could not start checkout. Try again or contact hello@synkra.co.za.");
    }
  }

  if (!service) {
    return <div className="min-h-screen bg-[#0a0a0a] p-8 text-white/40">Loading...</div>;
  }

  if (service.onboarding_status && service.onboarding_status !== "active") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="border-b border-white/10 px-8 py-6">
          <Link to="/" className="text-xs text-white/40 hover:text-white">← Back</Link>
          <h1 className="mt-2 text-xl font-semibold">{SERVICE_LABELS[slug] ?? slug}</h1>
        </header>
        <main className="mx-auto max-w-2xl px-8 py-16 text-center">
          <p className="text-sm text-white/60">
            This service is still being set up — usage, billing, and controls
            appear here once it goes live.
          </p>
          {service.onboarding_status === "paid" && (
            <Link
              to="/intake/$serviceRecordId"
              params={{ serviceRecordId: service.id }}
              className="mt-6 inline-block rounded-md bg-[#56d722] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a]"
            >
              Complete your intake form
            </Link>
          )}
        </main>
      </div>
    );
  }

  const remainingByType = groupCreditsByType(credits);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-8 py-6">
        <Link to="/" className="text-xs text-white/40 hover:text-white">← Back</Link>
        <h1 className="mt-2 text-xl font-semibold">{SERVICE_LABELS[slug] ?? slug}</h1>
        <p className="mt-1 text-sm capitalize text-white/50">{service.tier} tier · R{service.monthly_price}/month</p>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10 space-y-10">
        {service.pending_change !== "none" && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="text-sm text-amber-300">
              {service.pending_change === "pause_at_next_cycle"
                ? "This service will pause at the end of your current billing period. It keeps working normally until then."
                : "This service will be cancelled at the end of your current billing period. It keeps working normally until then."}
            </p>
            <button onClick={undoChange} disabled={busy} className="whitespace-nowrap text-sm text-white/60 underline hover:text-white">
              Undo
            </button>
          </div>
        )}

        <section>
          <h2 className="text-sm font-medium text-white/70">Usage this period</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(remainingByType).map(([type, { included, purchased }]) => (
              <div key={type} className="rounded-xl border border-white/10 bg-[#0f0f0f] p-5">
                <p className="text-xs text-white/50">{USAGE_LABELS[type] ?? type}</p>
                <p className="mt-2 text-2xl font-semibold">{included + purchased}</p>
                <p className="mt-1 text-xs text-white/40">
                  {included} included, {purchased} purchased remaining
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70">Recent activity</h2>
          <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10 bg-[#0f0f0f]">
            {recentEvents.length === 0 ? (
              <p className="p-5 text-sm text-white/40">No usage recorded yet.</p>
            ) : (
              recentEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-white/70">{USAGE_LABELS[e.usage_type] ?? e.usage_type}</span>
                  <span className="text-white/40">
                    {e.quantity} · {new Date(e.occurred_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70">Buy more usage</h2>
          <p className="mt-1 text-xs text-white/40">
            Purchased usage never expires with your billing period — it rolls over until used.
          </p>
          <div className="mt-4 space-y-6">
            {(Object.keys(ADDON_PACKS) as UsageType[]).map((usageType) => (
              <div key={usageType}>
                <p className="text-xs text-white/50">{USAGE_LABELS[usageType]}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ADDON_PACKS[usageType].map((pack) => {
                    const key = `${usageType}-${pack.quantity}`;
                    return (
                      <button
                        key={key}
                        onClick={() => buyAddon(usageType, pack.quantity, pack.priceRand)}
                        disabled={buyingPack !== null}
                        className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/80 hover:border-[#56d722]/50 hover:text-white disabled:opacity-50"
                      >
                        {buyingPack === key ? "Starting checkout..." : `${pack.label} — R${pack.priceRand}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {service.status === "active" && service.pending_change === "none" && (
          <section>
            <h2 className="text-sm font-medium text-white/70">Manage this service</h2>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirmingAction("pause")}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/80 hover:border-white/30"
              >
                Pause service
              </button>
              <button
                onClick={() => setConfirmingAction("cancel")}
                className="rounded-md border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:border-red-500/50"
              >
                Cancel service
              </button>
            </div>
          </section>
        )}
      </main>

      {confirmingAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f0f] p-6">
            <p className="text-sm text-white">
              {confirmingAction === "pause"
                ? "Pause this service at the end of your current billing period?"
                : "Cancel this service at the end of your current billing period?"}
            </p>
            <p className="mt-2 text-xs text-white/40">It keeps working normally until then. You can undo this before the period ends.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmingAction(null)} className="flex-1 rounded-md border border-white/15 px-4 py-2 text-sm text-white/70">
                Never mind
              </button>
              <button
                onClick={() => requestChange(confirmingAction)}
                disabled={busy}
                className="flex-1 rounded-md bg-red-500/90 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function groupCreditsByType(credits: any[]): Record<string, { included: number; purchased: number }> {
  const out: Record<string, { included: number; purchased: number }> = {};
  const now = Date.now();
  for (const c of credits) {
    if (new Date(c.expires_at).getTime() < now) continue; // expired, don't count
    out[c.usage_type] ??= { included: 0, purchased: 0 };
    out[c.usage_type][c.source as "included" | "purchased"] += c.remaining;
  }
  return out;
}
