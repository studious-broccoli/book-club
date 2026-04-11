import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Book, FinalSelection, MeetingDate, Poll, UserWithPreferences } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [dates, setDates] = useState<MeetingDate[]>([]);
  const [members, setMembers] = useState<UserWithPreferences[]>([]);
  const [poll, setPoll] = useState<Poll | null | undefined>(undefined);
  const [finalSelection, setFinalSelection] = useState<FinalSelection | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    api.get<Book[]>("/books").then((r) => setBooks(r.data));
    api.get<MeetingDate[]>("/dates").then((r) => setDates(r.data));
    api.get<UserWithPreferences[]>("/members").then((r) => setMembers(r.data)).catch(() => {});
    api.get<Poll | null>("/polls/active").then((r) => setPoll(r.data)).catch(() => setPoll(null));
    api.get<FinalSelection | null>("/clubs/final-selection").then((r) => setFinalSelection(r.data)).catch(() => {});
  }, []);

  const winner = books.find((b) => b.is_winner);
  const nextDate = dates[0];

  function formatDate(utc: string) {
    return new Date(utc).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Banner ── */}
      <div className="relative rounded-2xl overflow-hidden border border-app-border">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0F1F1A]" />
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-3 left-[15%] text-coven-gold text-base animate-twinkle">✦</span>
          <span className="absolute top-5 right-[20%] text-coven-silver text-xs animate-twinkle-slow">✦</span>
          <span className="absolute bottom-4 left-[40%] text-coven-spelgold text-xs animate-twinkle-fast">✦</span>
          <span className="absolute top-8 left-[60%] text-coven-silver text-xs animate-twinkle">✦</span>
          <span className="absolute bottom-3 right-[35%] text-coven-gold text-sm animate-twinkle-slow">✦</span>
        </div>
        <div className="relative px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-coven-silver mb-1">Welcome to</p>
          <h1 className="font-script text-5xl text-coven-amber">The Spicy Book Coven</h1>
          {user?.club_name && (
            <p className="text-lg font-semibold text-coven-lavender mt-0.5">{user.club_name}</p>
          )}
          {user && (
            <p className="text-sm mt-2 text-coven-silver">Hi {user.display_name}! {user.heart_color}</p>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Books nominated" value={books.length} to="/books" />
        <StatCard label="Proposed dates" value={dates.length} to="/schedule" />
        <StatCard label="Members" value={members.length} to="/members" />
      </div>

      {/* ── Confirmed meeting ── */}
      {finalSelection && (finalSelection.book_title || finalSelection.confirmed_datetime) && (
        <section className="bg-green-900/20 border border-green-700/50 rounded-xl p-5">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Confirmed meeting</p>
          {finalSelection.book_title && (
            <p className="text-lg font-bold text-white">{finalSelection.book_title}</p>
          )}
          {finalSelection.book_author && (
            <p className="text-sm text-gray-400">{finalSelection.book_author}</p>
          )}
          {finalSelection.confirmed_datetime && (
            <p className="text-sm font-medium text-green-400 mt-1">{formatDate(finalSelection.confirmed_datetime)}</p>
          )}
          {finalSelection.notes && (
            <p className="text-sm text-gray-400 mt-1">{finalSelection.notes}</p>
          )}
        </section>
      )}

      {/* ── Current pick (winner book) ── */}
      {winner && (
        <section className="bg-coven-gold/5 border border-coven-gold/20 rounded-xl p-5">
          <p className="text-xs font-semibold text-coven-amethyst uppercase tracking-wide mb-1">Current pick</p>
          <p className="text-lg font-bold text-coven-lavender">{winner.title}</p>
          <p className="text-sm text-gray-400">{winner.author}{winner.pages ? ` · ${winner.pages} pages` : ""}</p>
        </section>
      )}

      {/* ── Voting poll ── */}
      {poll !== undefined && (
        <VotingPoll
          poll={poll}
          isAdmin={user?.club_role === "admin"}
          onPollChange={setPoll}
        />
      )}

      {/* ── Next proposed date ── */}
      {nextDate && (
        <section className="bg-app-surface border border-app-border rounded-xl p-5">
          <p className="text-xs font-semibold text-coven-silver uppercase tracking-wide mb-1">Next proposed date</p>
          <p className="text-base font-semibold text-coven-spelgold">{formatDate(nextDate.datetime_utc)}</p>
          {nextDate.label && <p className="text-sm text-gray-400 mt-0.5">{nextDate.label}</p>}
          <p className="text-sm text-gray-400 mt-2">
            {nextDate.availability_summary.yes} of {members.length || "?"} available
          </p>
          <Link to="/schedule" className="text-sm text-coven-lavender hover:text-coven-mystic mt-1 inline-block transition-colors">
            Mark your availability →
          </Link>
        </section>
      )}

      {/* ── Coven art ── */}
      <div className="relative rounded-2xl overflow-hidden border border-app-border flex items-center justify-center py-8 bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0F1F1A]">
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-4 left-[10%] text-coven-gold text-lg animate-twinkle">✦</span>
          <span className="absolute top-6 right-[12%] text-coven-silver text-xs animate-twinkle-slow">✦</span>
          <span className="absolute bottom-5 left-[45%] text-coven-spelgold text-xs animate-twinkle-fast">✦</span>
          <span className="absolute bottom-4 right-[30%] text-coven-gold text-sm animate-twinkle">✦</span>
        </div>
        <img
          src="/TheSpicyBookCovenArt.png"
          alt="The Spicy Book Coven"
          className="relative h-[32rem] object-contain animate-float"
        />
      </div>

      {/* ── How to use ── */}
      <section className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowHowTo((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-app-raised transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-coven-silver">✦</span>
            <span className="text-sm font-semibold text-coven-lavender">How to use The Spicy Book Coven</span>
          </div>
          <span className="text-gray-500 text-xs">{showHowTo ? "▲ hide" : "▼ show"}</span>
        </button>
        {showHowTo && (
          <div className="px-5 pb-5 space-y-4 border-t border-app-border">
            <HowToStep
              icon="📚"
              title="1 · Suggest & rank books"
              body='Go to Books to suggest a book for the coven. You can also drag books in "My Ranking" to set your personal preference — this is used when generating a poll.'
            />
            <HowToStep
              icon="🗳️"
              title="2 · Vote in the poll"
              body="When an admin starts a poll, three books are chosen based on everyone's rankings. Vote for your favorite. Results stay hidden until voting closes."
            />
            <HowToStep
              icon="📅"
              title="3 · Mark your availability"
              body="Go to My Availability and click or drag dates. You can mark Morning (10am MT / 12pm ET), Afternoon (1pm MT / 3pm ET), and Evening (6pm MT / 8pm ET) slots separately. Update your availability any time."
            />
            <HowToStep
              icon="🗓️"
              title="4 · Propose & vote on dates"
              body="Any member can propose a meeting date in Schedule. Mark yourself as available or not on each proposed date."
            />
            <HowToStep
              icon="✅"
              title="5 · Confirmed meeting"
              body='Once a book and date are decided, the admin confirms them in Schedule → "Confirmed Meeting". It will appear here on the dashboard.'
            />
            <HowToStep
              icon="👑"
              title="Admin: Pick & manage"
              body='Admins can use "Pick" on a book to mark it as the current club pick, start and delete polls, confirm meetings, and manage members.'
            />
          </div>
        )}
      </section>
    </div>
  );
}

function HowToStep({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-3 pt-4">
      <span className="text-xl shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-coven-silver">{title}</p>
        <p className="text-sm text-gray-400 mt-0.5">{body}</p>
      </div>
    </div>
  );
}

// ── VotingPoll ────────────────────────────────────────────────────────────────

function VotingPoll({
  poll,
  isAdmin,
  onPollChange,
}: {
  poll: Poll | null;
  isAdmin: boolean;
  onPollChange: (p: Poll | null) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteSaved, setVoteSaved] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await api.post<Poll>("/polls", { end_date: endDate });
      onPollChange(res.data);
      setShowCreate(false);
      setEndDate("");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create poll.");
    } finally {
      setCreating(false);
    }
  }

  async function handleVote(bookId: number) {
    if (!poll || voting) return;
    setVoting(true);
    try {
      const res = await api.post<Poll>(`/polls/${poll.id}/vote`, { book_id: bookId });
      onPollChange(res.data);
      setVoteSaved(true);
      setTimeout(() => setVoteSaved(false), 2000);
    } finally {
      setVoting(false);
    }
  }

  async function handleDelete() {
    if (!poll || !confirm("Delete this poll?")) return;
    await api.delete(`/polls/${poll.id}`);
    onPollChange(null);
  }

  if (!poll) {
    if (!isAdmin) return null;
    return (
      <section className="bg-app-surface border border-app-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book vote</p>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-sm text-coven-lavender hover:text-coven-mystic transition-colors"
          >
            {showCreate ? "Cancel" : "+ Start poll"}
          </button>
        </div>
        {showCreate && (
          <form onSubmit={handleCreate} className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Voting ends</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coven-ember"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-coven-dragon hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? "Starting…" : "Start poll"}
            </button>
            {error && <p className="text-red-400 text-sm w-full">{error}</p>}
          </form>
        )}
        {!showCreate && (
          <p className="text-sm text-gray-500">No active poll. Start one to pick 3 books to vote on (chosen by everyone's rankings).</p>
        )}
      </section>
    );
  }

  const daysLeft = Math.ceil(
    (new Date(poll.end_date).getTime() - Date.now()) / 86_400_000
  );
  const maxVotes = poll.is_complete
    ? Math.max(...poll.book_options.map((b) => b.vote_count), 1)
    : 1;

  return (
    <section className="bg-app-surface border border-app-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {poll.is_complete ? "Poll complete" : "Vote for next book"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {poll.is_complete
              ? `${poll.votes_cast}/${poll.total_members} voted`
              : `${poll.votes_cast}/${poll.total_members} voted · ${daysLeft > 0 ? `${daysLeft}d left` : "Ended"}`}
          </p>
          {!poll.is_complete && (
            <p className="text-xs text-coven-flame mt-0.5">Results hidden until voting closes</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {voteSaved && <span className="text-xs text-green-400 font-medium">Vote saved ✓</span>}
          {isAdmin && (
            <button onClick={handleDelete} className="text-gray-500 hover:text-red-400 text-sm transition-colors">✕</button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {poll.book_options.map((opt) => {
          const isWinner = poll.winner_book_id === opt.book_id;

          return (
            <div
              key={opt.book_id}
              className={`rounded-lg border p-3 ${
                isWinner
                  ? "border-coven-amethyst/50 bg-coven-amethyst/10"
                  : "border-app-border bg-app-raised"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="font-medium text-white text-sm">{opt.title}</span>
                  <span className="text-gray-400 text-xs ml-2">{opt.author}</span>
                  {isWinner && <span className="ml-2 text-xs font-semibold text-coven-lavender">Winner! 🎉</span>}
                </div>
                {poll.is_complete && (
                  <span className="text-xs text-gray-500">{opt.vote_count} vote{opt.vote_count !== 1 ? "s" : ""}</span>
                )}
              </div>

              {poll.is_complete && (
                <div className="w-full h-1.5 bg-app-border rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${isWinner ? "bg-coven-amethyst" : "bg-app-border2"}`}
                    style={{ width: `${(opt.vote_count / maxVotes) * 100}%` }}
                  />
                </div>
              )}

              {!poll.is_complete && (
                <button
                  onClick={() => handleVote(opt.book_id)}
                  disabled={voting}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-50 ${
                    opt.user_voted
                      ? "bg-coven-amethyst/40 text-coven-lavender"
                      : "bg-app-border text-gray-400 hover:bg-coven-lavender/20 hover:text-coven-lavender"
                  }`}
                >
                  {opt.user_voted ? "✓ Your vote" : "Vote"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {poll.is_complete && poll.winner_book_id && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Voting closed · Go to{" "}
          <Link to="/schedule" className="text-coven-lavender hover:text-coven-mystic transition-colors">
            Schedule
          </Link>{" "}
          to confirm the meeting details
        </p>
      )}
    </section>
  );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="bg-app-surface border border-app-border rounded-xl p-5 hover:border-coven-lavender/50 transition-colors"
    >
      <p className="text-3xl font-bold text-coven-spelgold">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </Link>
  );
}
