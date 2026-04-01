import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { Book, MeetingDate, UserWithPreferences } from "../types";

export default function DashboardPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [dates, setDates] = useState<MeetingDate[]>([]);
  const [members, setMembers] = useState<UserWithPreferences[]>([]);

  useEffect(() => {
    api.get<Book[]>("/books").then((r) => setBooks(r.data));
    api.get<MeetingDate[]>("/dates").then((r) => setDates(r.data));
    api.get<UserWithPreferences[]>("/members").catch(() => setMembers([]));
    api.get<UserWithPreferences[]>("/members").then((r) => setMembers(r.data)).catch(() => {});
  }, []);

  const winner = books.find((b) => b.is_winner);
  const activeBooks = books.filter((b) => !b.is_winner);
  const nextDate = dates[0];

  function formatDate(utc: string) {
    const d = new Date(utc);
    const et = d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" });
    const mt = d.toLocaleString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return `${et} ET / ${mt}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Books nominated" value={books.length} to="/books" />
        <StatCard label="Proposed dates" value={dates.length} to="/schedule" />
        <StatCard label="Members" value={members.length} to="/members" />
      </div>

      {winner && (
        <section className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Current pick</p>
          <p className="text-lg font-bold text-gray-900">{winner.title}</p>
          <p className="text-sm text-gray-600">{winner.author}{winner.pages ? ` · ${winner.pages} pages` : ""}</p>
        </section>
      )}

      {nextDate && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Next proposed date</p>
          <p className="text-base font-semibold text-gray-900">{formatDate(nextDate.datetime_utc)}</p>
          {nextDate.label && <p className="text-sm text-gray-500 mt-0.5">{nextDate.label}</p>}
          <p className="text-sm text-gray-500 mt-2">
            {nextDate.availability_summary.yes} of {members.length || "?"} available
          </p>
          <Link to="/schedule" className="text-sm text-purple-600 hover:underline mt-1 inline-block">
            Mark your availability →
          </Link>
        </section>
      )}

      {activeBooks.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Voting in progress</p>
          <ul className="space-y-2">
            {activeBooks.slice(0, 5).map((b) => (
              <li key={b.id} className="flex justify-between items-center text-sm">
                <span className="text-gray-800 font-medium">{b.title}</span>
                <span className="text-gray-400">{b.vote_count} vote{b.vote_count !== 1 ? "s" : ""}</span>
              </li>
            ))}
          </ul>
          <Link to="/books" className="text-sm text-purple-600 hover:underline mt-3 inline-block">
            Vote on books →
          </Link>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 transition-colors"
    >
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </Link>
  );
}
