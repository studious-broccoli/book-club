import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function AuthCallbackPage() {
  const { provision } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // Supabase automatically exchanges the tokens in the URL hash/params
      // on client init; by now getSession() should return the verified session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Authentication failed. The link may have expired — please try again.");
        return;
      }

      const pendingStr = localStorage.getItem("pendingProvision");

      if (pendingStr) {
        // Club-password signup flow
        const { reg_token, display_name } = JSON.parse(pendingStr) as {
          reg_token: string;
          display_name: string;
          club_id: number;
        };
        await provision(reg_token, display_name);
      } else {
        // Invite flow — no reg_token; backend resolves club via pending_membership by email
        await provision(null, session.user.email ?? "");
      }

      navigate("/dashboard", { replace: true });
    }

    handleCallback().catch((err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as { message?: string })?.message ??
        "Something went wrong.";
      setError(detail);
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <p className="text-red-400 text-sm mb-6">{error}</p>
          <a
            href="/enter"
            className="text-sm text-coven-lavender hover:text-coven-gold transition-colors"
          >
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-3xl mb-4 animate-float">🔮</div>
        <p className="text-gray-400 text-sm">Setting up your account…</p>
      </div>
    </div>
  );
}
