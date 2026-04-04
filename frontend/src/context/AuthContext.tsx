import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import type { ClubEntry, User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Step 1: verify club password → returns list of clubs + their members */
  enterClub: (password: string) => Promise<ClubEntry[]>;
  /** Step 2: select a name and club → stores session */
  selectUser: (userId: number, clubId: number) => Promise<void>;
  /** Switch to a different club for the same user (re-issues token) */
  switchClub: (clubId: number) => Promise<void>;
  /** Re-fetch /auth/me and update the user in context (e.g. after profile update) */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  async function enterClub(password: string): Promise<ClubEntry[]> {
    const res = await api.post<ClubEntry[]>("/auth/enter", { password });
    return res.data;
  }

  async function selectUser(userId: number, clubId: number): Promise<void> {
    const res = await api.post<{ access_token: string; user: User }>("/auth/select", {
      user_id: userId,
      club_id: clubId,
    });
    localStorage.setItem("token", res.data.access_token);
    setUser(res.data.user);
  }

  async function switchClub(clubId: number): Promise<void> {
    if (!user) return;
    await selectUser(user.id, clubId);
  }

  async function refreshUser(): Promise<void> {
    const res = await api.get<User>("/auth/me");
    setUser(res.data);
  }

  function logout(): void {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, enterClub, selectUser, switchClub, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
