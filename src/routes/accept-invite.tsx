import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { pb } from "@/lib/pocketbase";

const SearchSchema = z.object({ token: z.string().min(1) });

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (s) => SearchSchema.parse(s),
  ssr: false,
  component: AcceptInvitePage,
});

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "accepted";

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const nav = useNavigate();

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const record = await pb
          .collection("agency_invites")
          .getFirstListItem(pb.filter("token = {:token}", { token }));
        if (record["status"] === "accepted") {
          setStatus("accepted");
          return;
        }
        if (record["status"] === "expired" || new Date(record["expires_at"] as string) < new Date()) {
          setStatus("expired");
          return;
        }
        setInvite(record);
        setStatus("valid");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Find-or-create the company record for this email's domain/company
      // name - a second invite to the same company should not create a
      // duplicate agency_clients row.
      let client: any;
      try {
        client = await pb
          .collection("agency_clients")
          .getFirstListItem(pb.filter("company_name = {:name}", { name: invite.company_name }));
      } catch {
        client = await pb.collection("agency_clients").create({
          company_name: invite.company_name,
          contact_name: "",
          contact_email: invite.email,
          contact_phone: "",
          billing_mode: "manual",
          status: "active",
        });
      }

      const user = await pb.collection("agency_client_users").create({
        email: invite.email,
        password,
        passwordConfirm: confirmPassword,
        agency_client_id: client.id,
        role: "owner",
        invited_at: invite.created,
        invite_accepted_at: new Date().toISOString(),
        verified: true,
        emailVisibility: true,
      });

      // Exactly the services named in the invite - this is what makes
      // "only see it alone" true from account creation onward.
      const serviceSlugs: string[] = invite.service_slugs ?? [];
      for (const slug of serviceSlugs) {
        await pb.collection("agency_client_services").create({
          agency_client_id: client.id,
          service_slug: slug,
          tier: "standard",
          monthly_price: 0,
          setup_price: 0,
          status: "active",
          onboarding_status: "paid",
          pending_change: "none",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          activated_at: new Date().toISOString(),
        });
      }

      await pb.collection("agency_invites").update(invite.id, { status: "accepted" });

      await pb.collection("agency_client_users").authWithPassword(invite.email, password);
      nav({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Could not set up your account. Contact hello@synkra.co.za.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <CenteredMessage title="Checking your invite..." />;
  }
  if (status === "invalid") {
    return <CenteredMessage title="Invite not found" body="This link isn't valid. Contact hello@synkra.co.za if you think this is a mistake." />;
  }
  if (status === "expired") {
    return <CenteredMessage title="This invite has expired" body="Contact hello@synkra.co.za for a new one." />;
  }
  if (status === "accepted") {
    return <CenteredMessage title="This invite has already been used" body="Head to the login page instead." link={{ to: "/login", label: "Go to login" }} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#0f0f0f] p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Synkra Agency Portal</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Set up your account</h1>
        <p className="mt-2 text-sm text-white/60">{invite.company_name} — {invite.email}</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs text-white/50">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#56d722] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50">Confirm password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#56d722] focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[#56d722] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] disabled:opacity-60"
          >
            {busy ? "Setting up..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CenteredMessage({ title, body, link }: { title: string; body?: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {body && <p className="mt-3 max-w-sm text-sm text-white/60">{body}</p>}
        {link && (
          <a href={link.to} className="mt-6 inline-block text-sm text-[#56d722] hover:underline">
            {link.label}
          </a>
        )}
      </div>
    </div>
  );
}
