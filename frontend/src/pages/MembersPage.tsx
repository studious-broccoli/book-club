import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ClubEntry, MemberWithPreferences } from "../types";

const inputCls = "border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember";

export default function MembersPage() {
  const { user } = useAuth();

  const [currentMembers, setCurrentMembers] = useState<MemberWithPreferences[]>([]);
  const [allClubs, setAllClubs] = useState<ClubEntry[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", password: "", email: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<MemberWithPreferences[]>("/members").then((r) => setCurrentMembers(r.data));
    api.get<ClubEntry[]>("/clubs").then((r) => setAllClubs(r.data));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post<MemberWithPreferences>("/members", {
        username: form.username,
        display_name: form.display_name || form.username,
        password: form.password,
        email: form.email || null,
        role: "member",
      });
      setCurrentMembers((prev) => [...prev, res.data]);
      setForm({ username: "", display_name: "", password: "", email: "" });
      setShowForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Failed to add member.");
    }
  }

  async function handleRemove(userId: number) {
    if (!confirm("Remove this member from the club?")) return;
    await api.delete(`/members/${userId}`);
    setCurrentMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  const otherClubs = allClubs.filter((c) => c.club_id !== user?.club_id);

  return (
    <div className="space-y-8">

      {/* Current club */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-coven-gold">Members</h1>
            <p className="text-coven-lavender font-medium mt-0.5">{user?.club_name}</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "+ Add member"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3 mb-4">
            <h2 className="font-semibold text-white">Add member to {user?.club_name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Username *"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className={inputCls}
                required
              />
              <input
                placeholder="Display name in this club *"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className={inputCls}
                required
              />
              <input
                placeholder="Password *"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={inputCls}
                required
              />
              <input
                placeholder="Email (optional)"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputCls}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add member
            </button>
          </form>
        )}

        <div className="space-y-3">
          {currentMembers.map((m) => (
            <div key={m.user_id} className="bg-app-surface border border-app-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.heart_color}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{m.display_name}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.role === "admin"
                            ? "bg-coven-amethyst/20 text-coven-lavender"
                            : "bg-app-raised text-gray-500"
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                    {m.username !== m.display_name && (
                      <p className="text-xs text-gray-500">@{m.username}</p>
                    )}
                    {m.email && <p className="text-sm text-gray-400 mt-0.5">{m.email}</p>}
                  </div>
                </div>
                {m.user_id !== user?.id && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {m.preferences && (
                <div className="mt-3 pt-3 border-t border-app-border text-sm text-gray-400 space-y-1">
                  {m.preferences.no_weeknights && <p>No weeknights</p>}
                  {m.preferences.preferred_days.length > 0 && (
                    <p>Prefers: {m.preferences.preferred_days.join(", ")}</p>
                  )}
                  {m.preferences.notes && <p>{m.preferences.notes}</p>}
                  {m.preferences.blackout_dates.length > 0 && (
                    <p>Blackout dates: {m.preferences.blackout_dates.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Other clubs */}
      {otherClubs.map((club) => (
        <section key={club.club_id}>
          <h2 className="text-2xl font-bold text-coven-gold">Members</h2>
          <p className="text-coven-lavender font-medium mt-0.5 mb-4">{club.club_name}</p>
          <div className="space-y-2">
            {club.members.map((m) => (
              <div key={m.user_id} className="bg-app-surface border border-app-border rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-xl">{m.heart_color}</span>
                <div>
                  <span className="font-medium text-white">{m.display_name}</span>
                  {m.username !== m.display_name && (
                    <p className="text-xs text-gray-500">@{m.username}</p>
                  )}
                </div>
                {m.role === "admin" && (
                  <span className="ml-auto text-xs bg-coven-amethyst/20 text-coven-lavender px-2 py-0.5 rounded-full">
                    admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
