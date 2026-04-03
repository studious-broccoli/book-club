import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Book, Cadence, FinalSelection, MeetingDate } from "../types";

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

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "Last" };

const FREQUENCY_OPTIONS = [
  { value: "weekly",       label: "Weekly" },
  { value: "biweekly",     label: "Every other week" },
  { value: "monthly",      label: "Monthly" },
  { value: "bimonthly",    label: "Every 2 months" },
  { value: "quarterly",    label: "Every 3 months (Quarterly)" },
  { value: "every6months", label: "Every 6 months" },
  { value: "every8months", label: "Every 8 months" },
];

function describeCadence(c: Cadence): string {
  const day = c.day_of_week !== null ? DAY_NAMES[c.day_of_week] : "?";
  let freq: string;
  switch (c.frequency) {
    case "weekly":       freq = `Every ${day}`; break;
    case "biweekly":     freq = `Every other ${day}`; break;
    case "bimonthly":    freq = `Every 2 months on ${day}`; break;
    case "quarterly":    freq = `Every 3 months on ${day}`; break;
    case "every6months": freq = `Every 6 months on ${day}`; break;
    case "every8months": freq = `Every 8 months on ${day}`; break;
    default:
      freq = c.week_of_month !== null
        ? `${WEEK_LABELS[c.week_of_month]} ${day} of every month`
        : `Monthly on ${day}`;
  }
  const time = c.preferred_time ? ` · ${c.preferred_time.charAt(0).toUpperCase() + c.preferred_time.slice(1)}` : "";
  return freq + time;
}

const inputCls = "w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coven-ember placeholder-gray-500";
const labelCls = "block text-xs text-gray-400 mb-1";

export default function SchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.club_role === "admin";

  const [dates, setDates] = useState<MeetingDate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", label: "" });
  const [error, setError] = useState("");

  const [cadence, setCadence] = useState<Cadence | null | undefined>(undefined);
  const [showCadenceForm, setShowCadenceForm] = useState(false);
  const [cadenceForm, setCadenceForm] = useState<{
    frequency: string; day_of_week: string; week_of_month: string; preferred_time: string; notes: string;
  }>({ frequency: "monthly", day_of_week: "5", week_of_month: "2", preferred_time: "", notes: "" });

  const [finalSel, setFinalSel] = useState<FinalSelection | null | undefined>(undefined);
  const [showFinalForm, setShowFinalForm] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [finalForm, setFinalForm] = useState({ book_id: "", date: "", time: "", notes: "" });
  const [finalError, setFinalError] = useState("");

  useEffect(() => {
    api.get<MeetingDate[]>("/dates").then((r) => setDates(r.data));
    api.get<Cadence | null>("/clubs/cadence").then((r) => setCadence(r.data)).catch(() => setCadence(null));
    api.get<FinalSelection | null>("/clubs/final-selection").then((r) => setFinalSel(r.data)).catch(() => setFinalSel(null));
    api.get<Book[]>("/books").then((r) => setBooks(r.data));
  }, []);

  // ── Meeting dates ─────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
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

  // ── Cadence ───────────────────────────────────────────────────────────────

  function openCadenceForm() {
    if (cadence) {
      setCadenceForm({
        frequency: cadence.frequency,
        day_of_week: cadence.day_of_week !== null ? String(cadence.day_of_week) : "5",
        week_of_month: cadence.week_of_month !== null ? String(cadence.week_of_month) : "2",
        preferred_time: cadence.preferred_time ?? "",
        notes: cadence.notes ?? "",
      });
    }
    setShowCadenceForm(true);
  }

  async function handleSaveCadence(e: React.FormEvent) {
    e.preventDefault();
    const showWeekOfMonth = cadenceForm.frequency === "monthly";
    const res = await api.put<Cadence>("/clubs/cadence", {
      frequency: cadenceForm.frequency,
      day_of_week: cadenceForm.day_of_week !== "" ? Number(cadenceForm.day_of_week) : null,
      week_of_month: showWeekOfMonth && cadenceForm.week_of_month !== ""
        ? Number(cadenceForm.week_of_month) : null,
      preferred_time: cadenceForm.preferred_time || null,
      notes: cadenceForm.notes || null,
    });
    setCadence(res.data);
    setShowCadenceForm(false);
  }

  async function handleDeleteCadence() {
    if (!confirm("Clear the cadence?")) return;
    await api.delete("/clubs/cadence");
    setCadence(null);
  }

  // ── Final selection ───────────────────────────────────────────────────────

  function openFinalForm() {
    if (finalSel) {
      const dt = finalSel.confirmed_datetime ? new Date(finalSel.confirmed_datetime) : null;
      setFinalForm({
        book_id: finalSel.book_id !== null ? String(finalSel.book_id) : "",
        date: dt ? dt.toISOString().slice(0, 10) : "",
        time: dt ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}` : "",
        notes: finalSel.notes ?? "",
      });
    }
    setShowFinalForm(true);
  }

  async function handleSaveFinal(e: React.FormEvent) {
    e.preventDefault();
    setFinalError("");
    try {
      let confirmed_datetime: string | null = null;
      if (finalForm.date && finalForm.time) {
        confirmed_datetime = new Date(`${finalForm.date}T${finalForm.time}:00`).toISOString();
      }
      const res = await api.put<FinalSelection>("/clubs/final-selection", {
        book_id: finalForm.book_id ? Number(finalForm.book_id) : null,
        confirmed_datetime,
        notes: finalForm.notes || null,
      });
      setFinalSel(res.data);
      setShowFinalForm(false);
    } catch {
      setFinalError("Failed to save.");
    }
  }

  async function handleDeleteFinal() {
    if (!confirm("Clear the final selection?")) return;
    await api.delete("/clubs/final-selection");
    setFinalSel(null);
  }

  const showWeekOfMonth = cadenceForm.frequency === "monthly";

  return (
    <div className="space-y-8">

      {/* ── Cadence ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-coven-gold">Meeting Cadence</h2>
          {isAdmin && !showCadenceForm && (
            <button onClick={openCadenceForm} className="text-sm text-coven-lavender hover:text-coven-gold transition-colors">
              {cadence ? "Edit" : "+ Set cadence"}
            </button>
          )}
        </div>

        {showCadenceForm && (
          <form onSubmit={handleSaveCadence} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Frequency</label>
                <select
                  value={cadenceForm.frequency}
                  onChange={(e) => setCadenceForm((f) => ({ ...f, frequency: e.target.value }))}
                  className={inputCls}
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Day of week</label>
                <select
                  value={cadenceForm.day_of_week}
                  onChange={(e) => setCadenceForm((f) => ({ ...f, day_of_week: e.target.value }))}
                  className={inputCls}
                >
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              {showWeekOfMonth && (
                <div>
                  <label className={labelCls}>Which week of month</label>
                  <select
                    value={cadenceForm.week_of_month}
                    onChange={(e) => setCadenceForm((f) => ({ ...f, week_of_month: e.target.value }))}
                    className={inputCls}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{WEEK_LABELS[n]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Preferred time</label>
                <select
                  value={cadenceForm.preferred_time}
                  onChange={(e) => setCadenceForm((f) => ({ ...f, preferred_time: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">No preference</option>
                  <option value="morning">Morning (10am MT / 12pm ET)</option>
                  <option value="afternoon">Afternoon (1pm MT / 3pm ET)</option>
                  <option value="evening">Evening (6pm MT / 8pm ET)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Notes (optional)</label>
                <input
                  value={cadenceForm.notes}
                  onChange={(e) => setCadenceForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Usually the 2nd Saturday at 7pm ET"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Save
              </button>
              <button type="button" onClick={() => setShowCadenceForm(false)} className="text-sm px-4 py-2 rounded-lg border border-app-border text-gray-400 hover:bg-app-raised">
                Cancel
              </button>
              {cadence && (
                <button type="button" onClick={handleDeleteCadence} className="ml-auto text-sm text-red-400 hover:text-red-300">
                  Clear cadence
                </button>
              )}
            </div>
          </form>
        )}

        {!showCadenceForm && cadence ? (
          <div className="bg-app-surface border border-app-border rounded-xl p-4">
            <p className="font-medium text-white">{describeCadence(cadence)}</p>
            {cadence.notes && <p className="text-sm text-gray-400 mt-0.5">{cadence.notes}</p>}
          </div>
        ) : !showCadenceForm && (
          <p className="text-sm text-gray-500">No cadence set yet.</p>
        )}
      </div>

      {/* ── Confirmed meeting ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-coven-gold">Confirmed Meeting</h2>
          {isAdmin && !showFinalForm && (
            <button onClick={openFinalForm} className="text-sm text-coven-lavender hover:text-coven-gold transition-colors">
              {finalSel ? "Edit" : "+ Confirm book & time"}
            </button>
          )}
        </div>

        {showFinalForm && (
          <form onSubmit={handleSaveFinal} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Book</label>
                <select
                  value={finalForm.book_id}
                  onChange={(e) => setFinalForm((f) => ({ ...f, book_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— No book selected —</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.title} — {b.author}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={finalForm.date}
                  onChange={(e) => setFinalForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Time (your local time)</label>
                <input
                  type="time"
                  value={finalForm.time}
                  onChange={(e) => setFinalForm((f) => ({ ...f, time: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Notes (optional)</label>
                <input
                  value={finalForm.notes}
                  onChange={(e) => setFinalForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Zoom link, location…"
                  className={inputCls}
                />
              </div>
            </div>
            {finalError && <p className="text-red-400 text-sm">{finalError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Save
              </button>
              <button type="button" onClick={() => setShowFinalForm(false)} className="text-sm px-4 py-2 rounded-lg border border-app-border text-gray-400 hover:bg-app-raised">
                Cancel
              </button>
              {finalSel && (
                <button type="button" onClick={handleDeleteFinal} className="ml-auto text-sm text-red-400 hover:text-red-300">
                  Clear
                </button>
              )}
            </div>
          </form>
        )}

        {!showFinalForm && finalSel ? (
          <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4 space-y-0.5">
            {finalSel.book_title && (
              <p className="font-semibold text-white">{finalSel.book_title}{finalSel.book_author ? ` — ${finalSel.book_author}` : ""}</p>
            )}
            {finalSel.confirmed_datetime && (
              <p className="text-sm text-green-400 font-medium">{formatDateET(finalSel.confirmed_datetime)}</p>
            )}
            {finalSel.confirmed_datetime && (
              <p className="text-sm text-gray-400">{formatTimeMT(finalSel.confirmed_datetime)}</p>
            )}
            {finalSel.notes && <p className="text-sm text-gray-400 pt-1">{finalSel.notes}</p>}
          </div>
        ) : !showFinalForm && (
          <p className="text-sm text-gray-500">No confirmed meeting yet.</p>
        )}
      </div>

      {/* ── Proposed dates — open to all members ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-coven-gold">Proposed Dates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Any member can propose a date for the group to vote on.</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "+ Propose date"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3 mb-4">
            <h2 className="font-semibold text-white">Propose a date</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Time (your local time)</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Label (optional)</label>
                <input
                  placeholder="e.g. Option A"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add date
            </button>
          </form>
        )}

        {dates.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No dates proposed yet.</p>
        )}

        <div className="space-y-4">
          {dates.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              currentUserId={user?.id ?? 0}
              isAdmin={isAdmin}
              onAvailability={handleAvailability}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DateCard({
  date,
  currentUserId: _currentUserId,
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
    <div className="bg-app-surface border border-app-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold text-white">{formatDateET(date.datetime_utc)}</p>
          <p className="text-sm text-gray-400">{formatTimeMT(date.datetime_utc)}</p>
          {date.label && <p className="text-sm text-gray-400 mt-0.5">{date.label}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400">
            {yes}/{total} available
          </span>
          {isAdmin && (
            <button
              onClick={() => onDelete(date.id)}
              className="text-gray-500 hover:text-red-400 transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {date.availabilities.map((a) => (
          <span
            key={a.user_id}
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              a.status === "yes"
                ? "bg-green-900/40 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {a.status === "yes" ? "✓" : "✗"} {a.display_name}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAvailability(date.id, date.my_status === "yes" ? null : "yes")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            date.my_status === "yes"
              ? "bg-green-700 text-white"
              : "bg-app-raised text-gray-400 hover:bg-green-900/30 hover:text-green-400"
          }`}
        >
          ✓ Available
        </button>
        <button
          onClick={() => onAvailability(date.id, date.my_status === "no" ? null : "no")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            date.my_status === "no"
              ? "bg-red-700 text-white"
              : "bg-app-raised text-gray-400 hover:bg-red-900/30 hover:text-red-400"
          }`}
        >
          ✗ Not available
        </button>
      </div>
    </div>
  );
}
