import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { MeetingDate } from "../types";

function formatDateET(utc: string) {
  return new Date(utc).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatTimeMT(utc: string) {
  return new Date(utc).toLocaleString("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [dates, setDates] = useState<MeetingDate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", label: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<MeetingDate[]>("/dates").then((r) => setDates(r.data));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      // Combine date + time and treat as ET (UTC-4 during EDT)
      const localDt = new Date(`${form.date}T${form.time}:00`);
      const res = await api.post<MeetingDate>("/dates", {
        datetime_utc: localDt.toISOString(),
        label: form.label || null,
      });
      setDates((prev) => [...prev, res.data].sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc)));
      setForm({ date: "", time: "", label: "" });
      setShowForm(false);
    } catch {
      setError("Failed to add date.");
    }
  }

  async function handleDelete(dateId: number) {
    if (!confirm("Remove this date?")) return;
    await api.delete(`/dates/${dateId}`);
    setDates((prev) => prev.filter((d) => d.id !== dateId));
  }

  async function handleAvailability(dateId: number, status: "yes" | "no" | null) {
    const res = await api.post<MeetingDate>(`/dates/${dateId}/availability`, { status });
    setDates((prev) => prev.map((d) => (d.id === dateId ? res.data : d)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "+ Add date"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Propose a date</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Time (your local time)</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Label (optional)</label>
              <input
                placeholder="e.g. Option A"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add date
          </button>
        </form>
      )}

      {dates.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">No dates proposed yet.</p>
      )}

      <div className="space-y-4">
        {dates.map((d) => (
          <DateCard
            key={d.id}
            date={d}
            currentUserId={user?.id ?? 0}
            isAdmin={user?.role === "admin"}
            onAvailability={handleAvailability}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function DateCard({
  date,
  currentUserId,
  isAdmin,
  onAvailability,
  onDelete,
}: {
  date: MeetingDate;
  currentUserId: number;
  isAdmin: boolean;
  onAvailability: (id: number, status: "yes" | "no" | null) => void;
  onDelete: (id: number) => void;
}) {
  const { yes, total } = date.availability_summary;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold text-gray-900">{formatDateET(date.datetime_utc)}</p>
          <p className="text-sm text-gray-400">{formatTimeMT(date.datetime_utc)}</p>
          {date.label && <p className="text-sm text-gray-500 mt-0.5">{date.label}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {yes}/{total} available
          </span>
          {isAdmin && (
            <button
              onClick={() => onDelete(date.id)}
              className="text-gray-400 hover:text-red-500 transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Availability grid */}
      <div className="flex flex-wrap gap-2 mb-4">
        {date.availabilities.map((a) => (
          <span
            key={a.user_id}
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              a.status === "yes"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {a.status === "yes" ? "✓" : "✗"} {a.username}
          </span>
        ))}
      </div>

      {/* Current user's response buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onAvailability(date.id, date.my_status === "yes" ? null : "yes")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            date.my_status === "yes"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700"
          }`}
        >
          ✓ Available
        </button>
        <button
          onClick={() => onAvailability(date.id, date.my_status === "no" ? null : "no")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            date.my_status === "no"
              ? "bg-red-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600"
          }`}
        >
          ✗ Not available
        </button>
      </div>
    </div>
  );
}
