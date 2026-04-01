import { useEffect, useState } from "react";
import api from "../api/client";
import type { UserWithPreferences } from "../types";

export default function MembersPage() {
  const [members, setMembers] = useState<UserWithPreferences[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<UserWithPreferences[]>("/members").then((r) => setMembers(r.data));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post<UserWithPreferences>("/members", {
        username: form.username,
        password: form.password,
        email: form.email || null,
        role: "member",
      });
      setMembers((prev) => [...prev, res.data]);
      setForm({ username: "", password: "", email: "" });
      setShowForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Failed to create member.");
    }
  }

  async function handleDelete(userId: number) {
    if (!confirm("Remove this member?")) return;
    await api.delete(`/members/${userId}`);
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ Add member"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">New member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="Username *"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
            <input
              placeholder="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
            <input
              placeholder="Email (optional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create member
          </button>
        </form>
      )}

      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{m.username}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      m.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
                {m.email && <p className="text-sm text-gray-500 mt-0.5">{m.email}</p>}
              </div>
              {m.role !== "admin" && (
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {m.preferences && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500 space-y-1">
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
    </div>
  );
}
