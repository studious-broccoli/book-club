import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { ClubEntry } from "../types";

type Step =
  | "login"
  | "forgot-password"
  | "reset-email-sent"
  | "register-club-pw"
  | "register-form"      // full signup (no existing Supabase account)
  | "provision-form"     // display-name only (already signed into Supabase)
  | "club-picker";

const inputCls =
  "w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-coven-amber placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember";

const primaryBtn =
  "w-full bg-coven-dragon hover:bg-coven-flame text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50";

const backBtn = "mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors";

const Stars = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <span className="absolute top-[12%] left-[8%] text-coven-gold text-xl animate-twinkle">✦</span>
    <span className="absolute top-[25%] right-[10%] text-coven-lavender text-sm animate-twinkle-slow">✦</span>
    <span className="absolute top-[60%] left-[15%] text-coven-ember text-xs animate-twinkle-fast">✦</span>
    <span className="absolute top-[75%] right-[20%] text-coven-gold text-base animate-twinkle">✦</span>
    <span className="absolute top-[40%] left-[5%] text-coven-silver text-xs animate-twinkle-slow">✦</span>
    <span className="absolute top-[85%] left-[60%] text-coven-lavender text-xs animate-twinkle-fast">✦</span>
    <span className="absolute top-[10%] right-[35%] text-coven-spelgold text-xs animate-twinkle">✦</span>
  </div>
);

export default function EntryPage() {
  const { pendingVerification, pendingEmail, signIn, signOut, enterClub, signUp, resendVerification, resetPassword, selectClub, provision } =
    useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("login");

  // login / forgot-password fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register-form fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [regToken, setRegToken] = useState("");
  const [pendingClubs, setPendingClubs] = useState<ClubEntry[]>([]);
  const [selectedRegClubId, setSelectedRegClubId] = useState<number | null>(null);
  const [selectedRegClubName, setSelectedRegClubName] = useState("");

  // club-picker (multi-club login)
  const [availableClubs, setAvailableClubs] = useState<ClubEntry[]>([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // ── Pending verification screen (overrides step) ──────────────────────────

  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Stars />
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-sm p-8 relative z-10 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-lg font-bold text-coven-gold mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="text-coven-amber text-sm font-medium mb-6">{pendingEmail}</p>
          <p className="text-gray-500 text-xs mb-6">
            Click the link in that email to finish setting up your account. Check your spam folder if you don't see it.
          </p>
          {resendSent ? (
            <p className="text-green-400 text-sm">Sent! Check your inbox.</p>
          ) : (
            <button
              onClick={async () => {
                if (!pendingEmail) return;
                try {
                  await resendVerification(pendingEmail);
                  setResendSent(true);
                } catch {
                  // silently ignore — Supabase rate-limits resends
                }
              }}
              className="text-sm text-gray-500 hover:text-coven-gold transition-colors"
            >
              Resend verification email
            </button>
          )}
          <div className="mt-6 pt-5 border-t border-app-border">
            <button
              onClick={async () => {
                await signOut();
                setResendSent(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const clubs = await signIn(email, password);
      if (clubs === null) {
        // Single club — auto-selected, navigate to app
        navigate("/dashboard");
      } else if (clubs.length === 0) {
        // Authenticated but no membership yet
        setError(
          "You're signed in but don't have a club membership yet. Ask your admin to invite you, or enter the club password to join.",
        );
      } else {
        // Multiple clubs — show picker
        setAvailableClubs(clubs);
        setStep("club-picker");
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
        setError("Wrong email or password.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Please verify your email before signing in.");
      } else {
        setError(msg || "Could not sign in. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setStep("reset-email-sent");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Register: club password ───────────────────────────────────────────────

  async function handleEnterClub(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const clubs = await enterClub(password);
      const { data: { session } } = await supabase.auth.getSession();
      const alreadySignedIn = !!session;

      setPendingClubs(clubs);
      if (clubs.length === 1) {
        setRegToken(clubs[0].reg_token ?? "");
        setSelectedRegClubId(clubs[0].club_id);
        setSelectedRegClubName(clubs[0].club_name);
        // If already authenticated in Supabase, skip signup — just pick a display name
        setStep(alreadySignedIn ? "provision-form" : "register-form");
      } else {
        setStep("club-picker");
        setAvailableClubs(clubs);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError("Wrong password. Ask the admin for the club password.");
      } else {
        setError("Could not reach the server. Make sure the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Register: sign up ─────────────────────────────────────────────────────

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedRegClubId || !regToken) return;
    setLoading(true);
    try {
      await signUp(regEmail, regPassword, displayName, regToken, selectedRegClubId);
      // AuthContext sets pendingVerification=true; this component re-renders to show check-email screen
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.toLowerCase().includes("already registered")) {
        setError("That email is already registered. Try signing in instead.");
      } else {
        setError(msg || "Could not create account. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Provision with existing Supabase session ──────────────────────────────

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedRegClubId || !regToken) return;
    setLoading(true);
    try {
      await provision(regToken, displayName);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as { message?: string })?.message ??
        "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Club picker (multi-club login or multi-club registration) ─────────────

  async function handlePickClub(club: ClubEntry) {
    setError("");
    setLoading(true);
    try {
      if (club.reg_token) {
        // Coming from register-club-pw with multiple matching clubs
        setRegToken(club.reg_token);
        setSelectedRegClubId(club.club_id);
        setSelectedRegClubName(club.club_name);
        setPendingClubs([]);
        setStep("register-form");
      } else {
        // Coming from login with multiple clubs
        await selectClub(club.club_id);
        navigate("/dashboard");
      }
    } catch {
      setError("Could not select club. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Stars />

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-sm p-8 relative z-10">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2 animate-float">🔮</div>
          <h1 className="text-2xl font-bold text-coven-gold">The Spicy Book Coven</h1>
        </div>

        {/* ── Login ── */}
        {step === "login" && (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">Sign in to your account</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => { setError(""); setStep("forgot-password"); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Forgot password?
              </button>
              <div className="w-full border-t border-app-border my-1" />
              <button
                onClick={() => { setError(""); setPassword(""); setStep("register-club-pw"); }}
                className="text-sm text-coven-lavender hover:text-coven-gold transition-colors"
              >
                New here? Enter the club password →
              </button>
            </div>
          </>
        )}

        {/* ── Forgot password ── */}
        {step === "forgot-password" && (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">
              Enter your email and we'll send a password reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <button onClick={() => { setError(""); setStep("login"); }} className={backBtn}>
              ← Back to sign in
            </button>
          </>
        )}

        {/* ── Reset email sent ── */}
        {step === "reset-email-sent" && (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <p className="text-gray-300 text-sm mb-2">Password reset email sent to</p>
            <p className="text-coven-amber text-sm font-medium mb-6">{email}</p>
            <p className="text-gray-500 text-xs mb-6">
              Click the link in that email to set a new password. Check spam if you don't see it.
            </p>
            <button onClick={() => { setStep("login"); setError(""); }} className={backBtn}>
              ← Back to sign in
            </button>
          </div>
        )}

        {/* ── Register: enter club password ── */}
        {step === "register-club-pw" && (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">Enter the club password to get started</p>
            <form onSubmit={handleEnterClub} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Club password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Checking…" : "Enter"}
              </button>
            </form>
            <button onClick={() => { setError(""); setPassword(""); setStep("login"); }} className={backBtn}>
              ← Back to sign in
            </button>
          </>
        )}

        {/* ── Register: create account form ── */}
        {step === "register-form" && (
          <>
            <p className="text-coven-gold text-sm font-medium mb-1 text-center">{selectedRegClubName}</p>
            <p className="text-gray-500 text-xs mb-5 text-center">Create your account</p>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                  placeholder="How the coven will know you"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className={inputCls}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className={inputCls}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
            <button
              onClick={() => { setError(""); setStep("register-club-pw"); }}
              className={backBtn}
            >
              ← Back
            </button>
          </>
        )}

        {/* ── Provision form (already signed into Supabase, just need display name) ── */}
        {step === "provision-form" && (
          <>
            <p className="text-coven-gold text-sm font-medium mb-1 text-center">{selectedRegClubName}</p>
            <p className="text-gray-500 text-xs mb-5 text-center">What should the coven call you?</p>
            <form onSubmit={handleProvision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                  placeholder="How the coven will know you"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Joining…" : "Join coven"}
              </button>
            </form>
            <button
              onClick={() => { setError(""); setStep("register-club-pw"); }}
              className={backBtn}
            >
              ← Back
            </button>
          </>
        )}

        {/* ── Club picker (login: multi-club, or register: multi-club-password match) ── */}
        {step === "club-picker" && (
          <>
            <p className="text-gray-400 text-sm mb-4 text-center">Which coven?</p>
            <div className="space-y-2">
              {availableClubs.map((club) => (
                <button
                  key={club.club_id}
                  onClick={() => handlePickClub(club)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-app-border bg-app-raised hover:border-coven-ember hover:bg-app-border transition-colors text-left disabled:opacity-50"
                >
                  <span className="font-medium text-white">{club.club_name}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {club.members.length} member{club.members.length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setError("");
                // If there were pending clubs (registration), go back to club-pw step; else login
                setStep(pendingClubs.length > 0 ? "register-club-pw" : "login");
              }}
              className={backBtn}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
