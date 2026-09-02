import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  component: DashboardPage,
});

const SERVICE_LABELS: Record<string, string> = {
  "ai-voice-agent": "AI Voice Agent",
  "speed-to-lead": "Speed to Lead",
  "lead-reactivation": "Lead Reactivation",
  "custom-ai-systems": "Custom AI Systems",
};

function DashboardPage() {
  const { agencyClientId } = Route.useRouteContext();
  const [services, setServices] = useState<any[] | null>(null);
  const [client, setClient] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const [servicesResult, clientResult] = await Promise.all([
        // The filter below is the entire access-control mechanism for
        // "only see what you bought" - not a role check, a data filter.
        // The collection's own API rule enforces this server-side too
        // (agency_client_id = @request.auth.agency_client_id) - this
        // client-side filter is redundant with that rule by design, not
        // a substitute for it.
        pb.collection("agency_client_services").getFullList({
          filter: pb.filter("agency_client_id = {:id}", { id: agencyClientId }),
          sort: "-activated_at",
        }),
        pb.collection("agency_clients").getOne(agencyClientId),
      ]);
      setServices(servicesResult);
      setClient(clientResult);
    })();
  }, [agencyClientId]);

  if (!services || !client) {
    return <div className="min-h-screen bg-[#0a0a0a] p-8 text-white/40">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-8 py-6">
        <p className="text-xs uppercase tracking-widest text-white/40">Synkra Agency Portal</p>
        <h1 className="mt-1 text-xl font-semibold">{client.company_name}</h1>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Your services</h2>
          <Link to="/billing" className="text-sm text-[#56d722] hover:underline">
            Manage payment →
          </Link>
        </div>

        {services.length === 0 ? (
          <p className="mt-6 text-sm text-white/50">
            No active services yet. Contact hello@synkra.co.za if this looks wrong.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {services.map((s) => (
              <div key={s.id}>
                <Link
                  to="/services/$slug"
                  params={{ slug: s.service_slug }}
                  className="flex items-center justify-between rounded-xl border p-6 transition-colors"
                  style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-card)" }}
                >
                  <div>
                    <p className="font-medium">{SERVICE_LABELS[s.service_slug] ?? s.service_slug}</p>
                    <p className="mt-1 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                      {s.tier} tier · R{s.monthly_price}/month
                    </p>
                  </div>
                  <StatusBadge status={s.status} pendingChange={s.pending_change} onboardingStatus={s.onboarding_status} />
                </Link>
                {s.onboarding_status === "paid" && (
                  <Link
                    to="/intake/$serviceRecordId"
                    params={{ serviceRecordId: s.id }}
                    className="mt-2 inline-block text-xs"
                    style={{ color: "var(--accent-green)" }}
                  >
                    Complete your intake form to start setup →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, pendingChange, onboardingStatus }: { status: string; pendingChange: string; onboardingStatus: string }) {
  // Onboarding pipeline takes visual precedence over billing status until
  // the service actually goes live - per ARCHITECTURE.md §3, these are
  // two different concerns and a client shouldn't see "active" billing
  // language for a service that hasn't finished implementation.
  if (onboardingStatus && onboardingStatus !== "active") {
    const labels: Record<string, string> = {
      quotation_sent: "Quote sent",
      invoiced: "Invoiced",
      paid: "Setting up",
      intake_form_completed: "Setting up",
      onboarding_scheduled: "Onboarding call scheduled",
      onboarding_completed: "Setting up",
      onboarding_notes_ready: "Setting up",
      implementation_triggered: "Being built",
      implementing: "Being built",
      pending_qc: "Final checks",
    };
    return (
      <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--state-info)", backgroundColor: "var(--state-info-bg)", color: "var(--state-info)" }}>
        {labels[onboardingStatus] ?? "In progress"}
      </span>
    );
  }
  if (pendingChange && pendingChange !== "none") {
    return (
      <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--state-warning)", backgroundColor: "var(--state-warning-bg)", color: "var(--state-warning)" }}>
        {pendingChange === "pause_at_next_cycle" ? "Pausing next cycle" : "Cancelling next cycle"}
      </span>
    );
  }
  const styles: Record<string, React.CSSProperties> = {
    active: { borderColor: "var(--accent-green-border)", backgroundColor: "var(--accent-green-subtle)", color: "var(--accent-green)" },
    paused: { borderColor: "var(--border-strong)", backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" },
    cancelled: { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "var(--state-error-bg)", color: "var(--state-error)" },
  };
  return (
    <span className="rounded-full border px-3 py-1 text-xs capitalize" style={styles[status] ?? styles.active}>
      {status}
    </span>
  );
}
