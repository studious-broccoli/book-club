import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Step 1: verify club password → returns member list to pick from */
  enterClub: (password: string) => Promise<User[]>;
  /** Step 2: select a name from the list → stores session */
  selectUser: (userId: number) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from stored token
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

  async function enterClub(password: string): Promise<User[]> {
    const res = await api.post<User[]>("/auth/enter", { password });
    return res.data;
  }

  async function selectUser(userId: number): Promise<void> {
    const res = await api.post<{ access_token: string; user: User }>("/auth/select", {
      user_id: userId,
    });
    localStorage.setItem("token", res.data.access_token);
    setUser(res.data.user);
  }

  function logout(): void {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, enterClub, selectUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
