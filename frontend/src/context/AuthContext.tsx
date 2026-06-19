import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import { supabase } from "../lib/supabase";
import type { ClubEntry, User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True after signUp until the user clicks their verification email */
  pendingVerification: boolean;
  /** The email address awaiting verification, for display purposes */
  pendingEmail: string | null;
  /**
   * Sign in with email + password via Supabase, then resolve club membership.
   * Returns null if a single club was auto-selected (caller can navigate to /dashboard).
   * Returns an empty array if the user has no club memberships yet.
   * Returns the club list if the user belongs to multiple clubs (caller shows picker).
   */
  signIn: (email: string, password: string) => Promise<ClubEntry[] | null>;
  signOut: () => Promise<void>;
  /** Step 1 of new-user registration: verify club password → returns clubs + reg_token */
  enterClub: (password: string) => Promise<ClubEntry[]>;
  /** Step 2 of new-user registration: create Supabase account and send verification email */
  signUp: (
    email: string,
    password: string,
    displayName: string,
    regToken: string,
    clubId: number,
  ) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  /**
   * Provision (or re-provision) the current Supabase session in the backend,
   * then select the resulting club. Called from AuthCallbackPage after email verification.
   */
  provision: (regToken: string | null, displayName: string) => Promise<void>;
  /** Set the active club, refresh /auth/me, and update user in context */
  selectClub: (clubId: number) => Promise<void>;
  refreshUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    // Restore pending-verification state across page reloads
    const storedEmail = sessionStorage.getItem("pendingVerificationEmail");
    if (storedEmail) {
      setPendingVerification(true);
      setPendingEmail(storedEmail);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }
      const storedClubId = localStorage.getItem("activeClubId");
      if (storedClubId) {
        api
          .get<User>("/auth/me")
          .then((res) => setUser(res.data))
          .catch(() => localStorage.removeItem("activeClubId"))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        localStorage.removeItem("activeClubId");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<ClubEntry[] | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    try {
      const res = await api.get<ClubEntry[]>("/clubs");
      const clubs = res.data;
      if (clubs.length === 0) return [];
      if (clubs.length === 1) {
        await selectClub(clubs[0].club_id);
        return null;
      }
      return clubs;
    } catch (err: unknown) {
      // 401 means the Supabase user hasn't been provisioned in our DB yet
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return [];
      throw err;
    }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    localStorage.removeItem("activeClubId");
    setUser(null);
  }

  async function enterClub(password: string): Promise<ClubEntry[]> {
    const res = await api.post<ClubEntry[]>("/auth/enter", { password });
    return res.data;
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
    regToken: string,
    clubId: number,
  ): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;

    // Persist provision payload across the email-verification redirect
    sessionStorage.setItem("pendingVerificationEmail", email);
    localStorage.setItem(
      "pendingProvision",
      JSON.stringify({ reg_token: regToken, display_name: displayName, club_id: clubId }),
    );
    setPendingVerification(true);
    setPendingEmail(email);
  }

  async function resendVerification(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async function provision(regToken: string | null, displayName: string): Promise<void> {
    const res = await api.post<{ access_token: string; user: User }>("/auth/provision", {
      reg_token: regToken,
      display_name: displayName,
    });
    await selectClub(res.data.user.club_id);
  }

  async function selectClub(clubId: number): Promise<void> {
    localStorage.setItem("activeClubId", String(clubId));
    const res = await api.get<User>("/auth/me");
    setUser(res.data);
    // Clear verification state now that the user is fully set up
    setPendingVerification(false);
    setPendingEmail(null);
    sessionStorage.removeItem("pendingVerificationEmail");
    localStorage.removeItem("pendingProvision");
  }

  async function refreshUser(): Promise<void> {
    const res = await api.get<User>("/auth/me");
    setUser(res.data);
  }

  async function resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingVerification,
        pendingEmail,
        signIn,
        signOut,
        enterClub,
        signUp,
        resendVerification,
        provision,
        selectClub,
        refreshUser,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
