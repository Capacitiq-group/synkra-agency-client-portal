import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { pb } from "@/lib/pocketbase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Synkra Agency Portal" },
      { name: "description", content: "Sign in to your Synkra Agency Portal account." },
    ],
  }),
  component: LoginPage,
});

const PROOF = [
  "See exactly what your service is doing, in real time",
  "Pause or cancel any service, effective at your next billing date",
  "One place for every invoice and payment",
];

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  height: 48,
  padding: "0 16px",
  color: "var(--text-primary)",
  fontSize: 15,
  width: "100%",
  outline: "none",
};

function Wordmark() {
  return (
    <div style={{ color: "var(--accent-green)", fontSize: 20, fontWeight: 800, letterSpacing: "0.1em" }}>
      SYNKRA
    </div>
  );
}

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await pb.collection("agency_client_users").authWithPassword(email, password);
      nav({ to: "/" });
    } catch {
      setError("The email or password is not correct.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row text-left" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left editorial column - hidden on mobile, matches client-hub's login exactly */}
      <div
        className="hidden md:flex flex-col justify-center border-r"
        style={{ width: "55%", backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)", padding: 64 }}
      >
        <Wordmark />
        <h1 style={{ marginTop: 64, fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: "var(--text-primary)", maxWidth: 560 }}>
          Your service runs whether you are here or not.
        </h1>
        <p style={{ marginTop: 20, fontSize: 15, color: "var(--text-secondary)", maxWidth: 380 }}>
          Log in to see usage, manage billing, and control what's running.
        </p>
        <div style={{ marginTop: 48 }}>
          {PROOF.map((item, i) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: i === 0 ? 0 : 16 }}>
              <Check size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form column - full width on mobile */}
      <div className="flex w-full flex-col justify-center p-8 md:p-16 md:w-[45%]">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden" style={{ marginBottom: 40 }}>
            <Wordmark />
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Welcome back
          </div>
          <h2 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@business.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 20 }}>
              <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", lineHeight: 0 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 20,
                  backgroundColor: "var(--state-error-bg)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "var(--state-error)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              style={{
                marginTop: 24,
                width: "100%",
                height: 48,
                backgroundColor: "var(--accent-green)",
                color: "var(--accent-green-foreground)",
                fontWeight: 600,
                fontSize: 15,
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : "Sign in"}
            </button>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-default)", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Access is invite-only.
              </p>
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
                Contact{" "}
                <a href="mailto:hello@synkra.co.za" style={{ color: "var(--accent-green)" }}>hello@synkra.co.za</a>{" "}
                if you're expecting access.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
