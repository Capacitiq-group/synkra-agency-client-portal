import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";

export const Route = createFileRoute("/_authed/intake/$serviceRecordId")({
  ssr: false,
  component: IntakeFormPage,
});

// Field set per service is a first draft, not final — per
// ARCHITECTURE.md §5, confirm the real requirements per service before
// this ships for real. Shape matches what 08-agency-services.md's
// system-prompt template expects for Voice Agent specifically; the other
// three are reasonable placeholders pending that same level of detail.
const FIELD_SETS: Record<string, { key: string; label: string; type: "text" | "textarea"; placeholder?: string }[]> = {
  "ai-voice-agent": [
    { key: "business_description", label: "What does your business do?", type: "textarea" },
    { key: "services_and_prices", label: "Services or products you offer, with prices", type: "textarea" },
    { key: "operating_hours", label: "Operating hours", type: "text", placeholder: "e.g. Mon-Fri 8am-5pm" },
    { key: "common_faqs", label: "Questions customers commonly ask", type: "textarea" },
    { key: "transfer_rules", label: "When should a call be transferred to a person, and to whom?", type: "textarea" },
    { key: "greeting_preference", label: "How should the agent greet callers?", type: "text" },
  ],
  "speed-to-lead": [
    { key: "business_description", label: "What does your business do?", type: "textarea" },
    { key: "lead_sources", label: "Where do your leads come from?", type: "textarea", placeholder: "e.g. website form, Facebook ads" },
    { key: "qualification_questions", label: "What should the AI ask to qualify a lead?", type: "textarea" },
    { key: "booking_process", label: "How should a qualified lead be booked or handed off?", type: "textarea" },
  ],
  "lead-reactivation": [
    { key: "business_description", label: "What does your business do?", type: "textarea" },
    { key: "campaign_goal", label: "What's the goal of this campaign?", type: "textarea", placeholder: "e.g. re-engage old enquiries, win back former customers" },
    { key: "personalisation_notes", label: "What should personalised messages be able to reference?", type: "textarea" },
    { key: "exclusions", label: "Anyone who should never be contacted?", type: "textarea" },
  ],
  "custom-ai-systems": [
    { key: "business_description", label: "What does your business do?", type: "textarea" },
    { key: "process_to_automate", label: "Describe the process this AI employee should handle", type: "textarea" },
    { key: "systems_involved", label: "Which systems does this process touch?", type: "textarea", placeholder: "e.g. CRM, email, calendar" },
    { key: "approval_points", label: "Where does a human need to approve before anything happens?", type: "textarea" },
  ],
};

function IntakeFormPage() {
  const { serviceRecordId } = Route.useParams();
  const nav = useNavigate();

  const [service, setService] = useState<any | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const svc = await pb.collection("agency_client_services").getOne(serviceRecordId);
      setService(svc);
    })();
  }, [serviceRecordId]);

  if (!service) {
    return <div className="min-h-screen p-8" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>Loading...</div>;
  }

  const fields = FIELD_SETS[service.service_slug] ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pb.collection("intake_forms").create({
        client_id: service.agency_client_id,
        agency_client_service_id: service.id,
        service: service.service_slug,
        plan_tier: service.tier,
        data: values,
        submitted_at: new Date().toISOString(),
      });
      await pb.collection("agency_client_services").update(service.id, {
        onboarding_status: "intake_form_completed",
      });
      nav({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Could not submit. Try again or contact hello@synkra.co.za.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header className="border-b px-8 py-6" style={{ borderColor: "var(--border-default)" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Get started</p>
        <h1 className="mt-1 text-xl font-semibold">Tell us about your business</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          This is what we build your service around. The more specific, the better.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-8 py-10">
        <form onSubmit={submit} className="space-y-6">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  rows={4}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-2 w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)", borderRadius: "var(--radius-md)" }}
                />
              ) : (
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-2 w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)", borderRadius: "var(--radius-md)" }}
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm" style={{ color: "var(--state-error)" }}>{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--accent-green)", color: "var(--accent-green-foreground)", borderRadius: "var(--radius-md)" }}
          >
            {busy ? "Submitting..." : "Submit and start setup"}
          </button>
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            After this, we'll schedule a short onboarding call before anything goes live.
          </p>
        </form>
      </main>
    </div>
  );
}
