import { useEffect, useRef, useState } from "react";
import api from "../api/client";

type Status = "available" | "tentative" | "unavailable";
type TimeSlot = "morning" | "afternoon" | "evening";
type AvailabilityMap = Record<string, Partial<Record<TimeSlot, Status>>>;

const STATUS_CONFIG: Record<Status, { label: string; icon: string; bg: string; text: string }> = {
  available:   { label: "Available",   icon: "✓", bg: "bg-green-500",  text: "text-white" },
  tentative:   { label: "Tentative",   icon: "~", bg: "bg-yellow-400", text: "text-white" },
  unavailable: { label: "Unavailable", icon: "✕", bg: "bg-red-400",    text: "text-white" },
};

const SLOT_CONFIG: Record<TimeSlot, { label: string; short: string; time: string }> = {
  morning:   { label: "Morning",   short: "AM",  time: "10am MT / 12pm ET" },
  afternoon: { label: "Afternoon", short: "PM",  time: "1pm MT / 3pm ET"  },
  evening:   { label: "Evening",   short: "Eve", time: "6pm MT / 8pm ET"  },
};

const ALL_SLOTS: TimeSlot[] = ["morning", "afternoon", "evening"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonths(count: number): { year: number; month: number }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

// ── DateCell ──────────────────────────────────────────────────────────────────

function DateCell({
  dateStr,
  isToday,
  slotStatuses,
  onMouseDown,
  onMouseEnter,
}: {
  dateStr: string;
  isToday: boolean;
  slotStatuses: Partial<Record<TimeSlot, Status>>;
  onMouseDown: (d: string) => void;
  onMouseEnter: (d: string) => void;
}) {
  const day = parseInt(dateStr.split("-")[2]);
  const hasAny = ALL_SLOTS.some((s) => slotStatuses[s]);
  const todayRing = isToday ? "ring-2 ring-coven-ember ring-offset-1 ring-offset-app-surface" : "";

  return (
    <div
      className={`relative w-10 rounded-md border cursor-pointer select-none transition-colors overflow-hidden ${
        hasAny ? "border-app-border2" : "border-app-border hover:border-app-border2"
      } ${todayRing}`}
      onMouseDown={() => onMouseDown(dateStr)}
      onMouseEnter={() => onMouseEnter(dateStr)}
    >
      <div className={`text-center text-[10px] py-0.5 font-medium ${hasAny ? "text-gray-300" : "text-gray-500"}`}>
        {day}
      </div>
      {ALL_SLOTS.map((slot) => {
        const status = slotStatuses[slot];
        return (
          <div
            key={slot}
            className={`text-center text-[9px] py-px leading-tight ${
              status
                ? `${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].text}`
                : "bg-app-raised text-gray-600"
            }`}
          >
            {status ? STATUS_CONFIG[status].icon : SLOT_CONFIG[slot].short}
          </div>
        );
      })}
    </div>
  );
}

// ── MonthCard ─────────────────────────────────────────────────────────────────

function MonthCard({
  year,
  month,
  availability,
  onMouseDown,
  onMouseEnter,
}: {
  year: number;
  month: number;
  availability: AvailabilityMap;
  onMouseDown: (d: string) => void;
  onMouseEnter: (d: string) => void;
}) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4">
      <p className="text-sm font-semibold text-coven-silver mb-3 text-center">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="w-10 h-5 flex items-center justify-center text-[10px] font-medium text-gray-500">
            {d}
          </div>
        ))}
        {cells.map((dateStr, i) =>
          dateStr ? (
            <DateCell
              key={dateStr}
              dateStr={dateStr}
              isToday={dateStr === todayStr}
              slotStatuses={availability[dateStr] ?? {}}
              onMouseDown={onMouseDown}
              onMouseEnter={onMouseEnter}
            />
          ) : (
            <div key={`empty-${i}`} className="w-10" />
          )
        )}
      </div>
    </div>
  );
}

// ── AvailabilityPage ──────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [activeStatus, setActiveStatus] = useState<Status>("available");
  const [activeSlots, setActiveSlots] = useState<Set<TimeSlot>>(new Set(["morning"]));
  const [saveLabel, setSaveLabel] = useState<"saved" | "saving" | "error" | "">("");
  const pendingWrites = useRef<Map<string, string | null>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const months = getMonths(6);

  useEffect(() => {
    api.get<{ date: string; time_slot: string; status: string }[]>("/availability/me").then((res) => {
      const map: AvailabilityMap = {};
      res.data.forEach((r) => {
        if (!map[r.date]) map[r.date] = {};
        map[r.date][r.time_slot as TimeSlot] = r.status as Status;
      });
      setAvailability(map);
    });
  }, []);

  // Flush all pending writes immediately — always resolves, never stays "saving" forever
  async function flushWrites() {
    const writes = [...pendingWrites.current.entries()];
    if (writes.length === 0) { setSaveLabel(""); return; }
    pendingWrites.current.clear();
    setSaveLabel("saving");
    try {
      await Promise.all(
        writes.map(([key, status]) => {
          const [date, time_slot] = key.split("|");
          return api.post("/availability/me", { date, time_slot, status });
        })
      );
      setSaveLabel("saved");
    } catch {
      // Re-queue failed writes so nothing is lost
      writes.forEach(([key, status]) => {
        if (!pendingWrites.current.has(key)) pendingWrites.current.set(key, status);
      });
      setSaveLabel("error");
    }
    setTimeout(() => setSaveLabel(""), 2000);
  }

  async function applyDate(dateStr: string) {
    if (activeSlots.size === 0) return;

    const allMatch = [...activeSlots].every(
      (slot) => availability[dateStr]?.[slot] === activeStatus
    );
    const next: Status | null = allMatch ? null : activeStatus;

    setAvailability((prev) => {
      const updated = { ...prev };
      const day = { ...(updated[dateStr] ?? {}) };
      activeSlots.forEach((slot) => {
        if (next === null) delete day[slot];
        else day[slot] = next;
      });
      if (Object.keys(day).length === 0) delete updated[dateStr];
      else updated[dateStr] = day;
      return updated;
    });

    setSaveLabel("saving");
    activeSlots.forEach((slot) => {
      pendingWrites.current.set(`${dateStr}|${slot}`, next);
    });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => flushWrites(), 400);
  }

  function handleMouseDown(dateStr: string) {
    isDragging.current = true;
    applyDate(dateStr);
  }

  function handleMouseEnter(dateStr: string) {
    if (isDragging.current) applyDate(dateStr);
  }

  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  async function markWeekendsAvailable() {
    const newMap = { ...availability };
    const writes: { date: string; time_slot: TimeSlot; status: Status }[] = [];

    months.forEach(({ year, month }) => {
      const days = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const dow = new Date(year, month, d).getDay();
        if (dow === 0 || dow === 6) {
          const dateStr = toDateStr(year, month, d);
          if (!newMap[dateStr]) newMap[dateStr] = {};
          ALL_SLOTS.forEach((slot) => {
            newMap[dateStr][slot] = "available";
            writes.push({ date: dateStr, time_slot: slot, status: "available" });
          });
        }
      }
    });

    setAvailability(newMap);
    setSaveLabel("saving");
    try {
      await Promise.all(writes.map(({ date, time_slot, status }) =>
        api.post("/availability/me", { date, time_slot, status })
      ));
      setSaveLabel("saved");
    } catch {
      setSaveLabel("error");
    }
    setTimeout(() => setSaveLabel(""), 2000);
  }

  async function clearAll() {
    if (!confirm("Clear all your availability?")) return;
    await api.delete("/availability/me");
    setAvailability({});
    setSaveLabel("saved");
    setTimeout(() => setSaveLabel(""), 1500);
  }

  const hasPending = pendingWrites.current.size > 0;

  return (
    <div className="space-y-6" onMouseLeave={() => { isDragging.current = false; }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-coven-gold">My Availability</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Mark your availability by time of day · Updates save automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Manual save button */}
          <button
            onClick={() => {
              if (flushTimer.current) clearTimeout(flushTimer.current);
              flushWrites();
            }}
            disabled={saveLabel === "saving"}
            className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-gray-400 hover:bg-app-raised hover:text-white disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          {/* Auto-save status */}
          <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${
            saveLabel === "saving" ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/40" :
            saveLabel === "saved"  ? "bg-green-900/30 text-green-400 border border-green-700/40" :
            saveLabel === "error"  ? "bg-red-900/30 text-red-400 border border-red-700/40" :
            "opacity-0 pointer-events-none"
          }`}>
            {saveLabel === "saving" && <span className="animate-pulse">●</span>}
            {saveLabel === "saved"  && <span>✓</span>}
            {saveLabel === "error"  && <span>!</span>}
            {saveLabel === "saving" ? "Saving…" :
             saveLabel === "error"  ? "Save failed — retry" :
             "Saved"}
          </div>
        </div>
      </div>

      {/* ── Meeting time info box ── */}
      <div className="bg-coven-amethyst/10 border border-coven-amethyst/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-coven-lavender uppercase tracking-wide mb-2">Configured meeting times</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALL_SLOTS.map((slot) => (
            <div key={slot} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] shrink-0 ${STATUS_CONFIG.available.bg} text-white`}>
                {SLOT_CONFIG[slot].short}
              </span>
              <div>
                <p className="text-xs font-medium text-white">{SLOT_CONFIG[slot].label}</p>
                <p className="text-xs text-gray-400">{SLOT_CONFIG[slot].time}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">Your availability is always editable — update it any time things change.</p>
      </div>

      {/* Mode selectors */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-14">Status:</span>
          {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                activeStatus === s
                  ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-transparent`
                  : "bg-app-raised border-app-border text-gray-400 hover:bg-app-border hover:text-white"
              }`}
            >
              <span>{STATUS_CONFIG[s].icon}</span>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 w-14">Slot:</span>
          {ALL_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() =>
                setActiveSlots((prev) => {
                  const next = new Set(prev);
                  next.has(slot) ? next.delete(slot) : next.add(slot);
                  return next;
                })
              }
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                activeSlots.has(slot)
                  ? "bg-coven-amethyst text-white border-transparent"
                  : "bg-app-raised border-app-border text-gray-400 hover:bg-app-border hover:text-white"
              }`}
            >
              {SLOT_CONFIG[slot].label}
            </button>
          ))}
          <button
            onClick={() => setActiveSlots(new Set(ALL_SLOTS))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              activeSlots.size === ALL_SLOTS.length
                ? "bg-coven-amethyst text-white border-transparent"
                : "bg-app-raised border-app-border text-gray-400 hover:bg-app-border hover:text-white"
            }`}
          >
            All day
          </button>
          <span className="text-xs text-gray-500 ml-1">Click or drag dates to mark them</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {months.map(({ year, month }) => (
          <MonthCard
            key={`${year}-${month}`}
            year={year}
            month={month}
            availability={availability}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
          />
        ))}
      </div>

      {/* Legend + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-app-border">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Legend</span>
          {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text}`}>
                {STATUS_CONFIG[s].icon}
              </span>
              {STATUS_CONFIG[s].label}
            </span>
          ))}
          <span className="text-xs text-gray-500">· Each cell row = AM / PM / Eve</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markWeekendsAvailable}
            disabled={saveLabel === "saving"}
            className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-gray-400 hover:bg-app-raised hover:text-white disabled:opacity-40 transition-colors"
          >
            Mark weekends available
          </button>
          <button
            onClick={clearAll}
            className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-gray-500 hover:bg-red-900/20 hover:text-red-400 hover:border-red-700/40 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}
