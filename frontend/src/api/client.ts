import axios from "axios";
import { supabase } from "../lib/supabase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    // Legacy token fallback for users who haven't migrated to Supabase yet
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  const clubId = localStorage.getItem("activeClubId");
  if (clubId) config.headers["X-Club-Id"] = clubId;

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on the entry page (e.g. /clubs returning 401
      // because the user isn't provisioned yet — the caller handles that inline).
      const onEntryPage = window.location.pathname === "/enter";
      if (!onEntryPage) {
        await supabase.auth.signOut();
        localStorage.removeItem("token");
        localStorage.removeItem("activeClubId");
        window.location.href = "/enter";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
