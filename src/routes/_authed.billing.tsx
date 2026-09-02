import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { pb } from "@/lib/pocketbase";

const SearchSchema = z.object({ reference: z.string().optional() });

export const Route = createFileRoute("/_authed/billing")({
  ssr: false,
  validateSearch: (s) => SearchSchema.parse(s),
  component: BillingPage,
});

const SERVICE_LABELS: Record<string, string> = {
  "ai-voice-agent": "AI Voice Agent",
  "speed-to-lead": "Speed to Lead",
  "lead-reactivation": "Lead Reactivation",
  "custom-ai-systems": "Custom AI Systems",
};

function BillingPage() {
  const { agencyClientId } = Route.useRouteContext();
  const { reference } = Route.useSearch();

  const [client, setClient] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [c, svcs, pays] = await Promise.all([
        pb.collection("agency_clients").getOne(agencyClientId),
        pb.collection("agency_client_services").getFullList({
          filter: pb.filter("agency_client_id = {:id} && status = 'active' && onboarding_status = 'active'", { id: agencyClientId }),
        }),
        pb.collection("agency_payments").getList(1, 20, {
          filter: pb.filter("agency_client_id = {:id}", { id: agencyClientId }),
          sort: "-created",
        }),
      ]);
      setClient(c);
      setServices(svcs);
      setPayments(pays.items);

      // The redirect back from Paystack is a UI convenience only (see
      // ARCHITECTURE.md §13) - confirm against the actual record, which
      // only the webhook ever sets to "success", rather than trusting
      // the fact that we landed on this page at all.
      if (reference) {
        try {
          const payment = await pb
            .collection("agency_payments")
            .getFirstListItem(pb.filter("paystack_reference = {:ref}", { ref: reference }));
          setJustCompleted(payment.status === "success");
        } catch {
          setJustCompleted(false);
        }
      }
    })();
  }, [agencyClientId, reference]);

  async function payNow(service: any) {
    setPayingId(service.id);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${pb.authStore.token}` },
        body: JSON.stringify({
          agency_client_service_id: service.id,
          purpose: "monthly_renewal",
          amount_rand: service.monthly_price,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch {
      setPayingId(null);
      alert("Could not start checkout. Try again or contact hello@synkra.co.za.");
    }
  }

  if (!client) {
    return <div className="min-h-screen bg-[#0a0a0a] p-8 text-white/40">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-8 py-6">
        <Link to="/" className="text-xs text-white/40 hover:text-white">← Back</Link>
        <h1 className="mt-2 text-xl font-semibold">Billing</h1>
      </header>

      <main className="mx-auto max-w-2xl px-8 py-10 space-y-10">
        {justCompleted !== null && (
          <div
            className={`rounded-xl border p-5 text-sm ${
              justCompleted
                ? "border-[#56d722]/30 bg-[#56d722]/5 text-[#56d722]"
                : "border-amber-500/30 bg-amber-500/5 text-amber-300"
            }`}
          >
            {justCompleted
              ? "Payment confirmed."
              : "We haven't confirmed this payment yet. If you completed checkout, this usually updates within a minute — refresh to check again."}
          </div>
        )}

        <section>
          <h2 className="text-sm font-medium text-white/70">Billing mode</h2>
          <p className="mt-2 text-sm text-white/60 capitalize">
            {client.billing_mode === "recurring"
              ? "Recurring — charged automatically at each billing period."
              : "Manual — you pay each period yourself, below."}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Contact hello@synkra.co.za to change your billing mode.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70">Active services</h2>
          <div className="mt-4 space-y-3">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f0f0f] p-5">
                <div>
                  <p className="text-sm font-medium">{SERVICE_LABELS[s.service_slug] ?? s.service_slug}</p>
                  <p className="mt-1 text-xs text-white/40">R{s.monthly_price}/month</p>
                </div>
                {client.billing_mode === "manual" && (
                  <button
                    onClick={() => payNow(s)}
                    disabled={payingId !== null}
                    className="rounded-md bg-[#56d722] px-4 py-2 text-sm font-semibold text-[#0a0a0a] disabled:opacity-60"
                  >
                    {payingId === s.id ? "Starting..." : "Pay now"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70">Payment history</h2>
          <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10 bg-[#0f0f0f]">
            {payments.length === 0 ? (
              <p className="p-5 text-sm text-white/40">No payments yet.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="capitalize text-white/70">{p.purpose.replace(/_/g, " ")}</span>
                  <span className="text-white/40">
                    R{p.amount_rand} · <span className="capitalize">{p.status}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
