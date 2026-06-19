import { useState } from "react";
import { supabase } from "../lib/supabase";

const inputCls =
  "w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-coven-amber placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-[12%] left-[8%] text-coven-gold text-xl animate-twinkle">✦</span>
        <span className="absolute top-[60%] left-[15%] text-coven-ember text-xs animate-twinkle-fast">✦</span>
        <span className="absolute top-[75%] right-[20%] text-coven-gold text-base animate-twinkle">✦</span>
        <span className="absolute top-[25%] right-[10%] text-coven-lavender text-sm animate-twinkle-slow">✦</span>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-sm p-8 relative z-10">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2 animate-float">🔮</div>
          <h1 className="text-2xl font-bold text-coven-gold">The Spicy Book Coven</h1>
        </div>

        {done ? (
          <div className="text-center">
            <div className="text-3xl mb-4">✅</div>
            <p className="text-gray-300 text-sm mb-6">Your password has been updated.</p>
            <a
              href="/enter"
              className="inline-block bg-coven-dragon hover:bg-coven-flame text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors"
            >
              Sign in
            </a>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">Set a new password for your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  required
                  autoFocus
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-coven-dragon hover:bg-coven-flame text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
            <div className="mt-4 text-center">
              <a href="/enter" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                ← Back to sign in
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
