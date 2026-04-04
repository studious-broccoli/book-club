import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { GroupAvailabilityDay, SlotAvailability } from "../types";

function buildMonths(count: number): { year: number; month: number; days: string[] }[] {
  const today = new Date();
  const months = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push(iso);
    }
    months.push({ year, month, days });
  }
  return months;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function slotBg(slot: SlotAvailability, totalMembers: number): string {
  if (totalMembers === 0) return "bg-app-raised";
  const pct = slot.available / totalMembers;
  if (pct >= 0.9) return "bg-green-600";
  if (pct >= 0.6) return "bg-green-800/70";
  if (pct >= 0.3) return "bg-yellow-800/60";
  if (slot.unavailable > 0) return "bg-red-900/40";
  return "bg-app-raised";
}

function Tooltip({ day, totalMembers }: { day: GroupAvailabilityDay; totalMembers: number }) {
  const slots = [
    { label: "Morning", data: day.morning },
    { label: "Afternoon", data: day.afternoon },
    { label: "Evening", data: day.evening },
  ] as const;

  return (
    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-app-surface border border-app-border text-white text-xs rounded-lg p-2 shadow-lg pointer-events-none">
      <div className="font-medium mb-2 text-coven-gold">{day.date}</div>
      {slots.map(({ label, data }) => (
        <div key={label} className="mb-1.5">
          <div className="text-gray-400 font-medium mb-0.5">{label}</div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">✓ {data.available}</span>
            <span className="text-yellow-400">~ {data.tentative}</span>
            <span className="text-red-400">✗ {data.unavailable}</span>
          </div>
        </div>
      ))}
      <div className="text-gray-500 mt-1 border-t border-app-border pt-1">of {totalMembers} members</div>
    </div>
  );
}

function DateCell({
  iso,
  day,
  totalMembers,
  isToday,
}: {
  iso: string;
  day: GroupAvailabilityDay | undefined;
  totalMembers: number;
  isToday: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const dayNum = parseInt(iso.split("-")[2], 10);

  const empty: SlotAvailability = { available: 0, tentative: totalMembers, unavailable: 0 };
  const morning = day?.morning ?? empty;
  const afternoon = day?.afternoon ?? empty;
  const evening = day?.evening ?? empty;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`
          rounded-md overflow-hidden cursor-default
          ${isToday ? "ring-2 ring-coven-ember ring-offset-1 ring-offset-app-surface" : ""}
          border border-app-border/50
        `}
      >
        <div className="text-center text-[10px] font-medium text-gray-400 py-0.5 bg-app-raised/60">
          {dayNum}
        </div>
        <div className={`h-2 ${day ? slotBg(morning, totalMembers) : "bg-app-raised"}`} />
        <div className={`h-2 ${day ? slotBg(afternoon, totalMembers) : "bg-app-raised"}`} />
        <div className={`h-2 ${day ? slotBg(evening, totalMembers) : "bg-app-raised"}`} />
      </div>
      {hovered && day && <Tooltip day={day} totalMembers={totalMembers} />}
    </div>
  );
}

function MonthCard({
  year,
  month,
  days,
  dayMap,
  totalMembers,
}: {
  year: number;
  month: number;
  days: string[];
  dayMap: Map<string, GroupAvailabilityDay>;
  totalMembers: number;
}) {
  const today = new Date().toISOString().split("T")[0];
  const firstDow = new Date(year, month, 1).getDay();
  const blanks = Array(firstDow).fill(null);

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4">
      <h3 className="font-semibold text-coven-silver mb-3">
        {MONTH_NAMES[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-xs text-gray-500 font-medium py-1">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map((iso) => (
          <DateCell
            key={iso}
            iso={iso}
            day={dayMap.get(iso)}
            totalMembers={totalMembers}
            isToday={iso === today}
          />
        ))}
      </div>
    </div>
  );
}

export default function GroupAvailabilityPage() {
  const { user } = useAuth();
  const [dayMap, setDayMap] = useState<Map<string, GroupAvailabilityDay>>(new Map());
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const months = buildMonths(6);

  useEffect(() => {
    api
      .get<GroupAvailabilityDay[]>("/clubs/group-availability")
      .then((res) => {
        const map = new Map<string, GroupAvailabilityDay>();
        let maxMembers = 0;
        for (const d of res.data) {
          map.set(d.date, d);
          if (d.total_members > maxMembers) maxMembers = d.total_members;
        }
        setDayMap(map);
        setTotalMembers(maxMembers);
      })
      .catch(() => setError("Failed to load group availability."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-coven-gold">Group Availability</h2>
        <p className="text-coven-lavender font-medium mt-0.5">{user?.club_name}</p>
        <p className="text-gray-400 text-sm mt-1">
          Each day shows three slots: morning, afternoon, evening. Members mark their own schedule in{" "}
          <strong className="text-coven-silver">My Availability</strong>. Unmarked slots count as tentative.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-600" />
          <span className="text-gray-400">Almost everyone free (&ge;90%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-800/70" />
          <span className="text-gray-400">Most free (&ge;60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-800/60" />
          <span className="text-gray-400">Some free (&ge;30%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-900/40" />
          <span className="text-gray-400">Mostly unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-app-raised border border-app-border" />
          <span className="text-gray-400">No data / tentative</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-6">
        <span>Each cell row = <span className="text-gray-400">AM · PM · Eve</span></span>
        <span>·</span>
        <span>Hover for details</span>
      </div>

      {totalMembers === 0 && (
        <p className="text-gray-500 text-sm mb-6">
          No availability data yet — members can add their schedule in My Availability.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map(({ year, month, days }) => (
          <MonthCard
            key={`${year}-${month}`}
            year={year}
            month={month}
            days={days}
            dayMap={dayMap}
            totalMembers={totalMembers}
          />
        ))}
      </div>
    </div>
  );
}
