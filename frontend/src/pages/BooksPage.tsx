import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { GENRES, genreEmoji } from "../config/genres";
import type { Book, BookRanking } from "../types";

// ── Genre autocomplete input ──────────────────────────────────────────────────

function GenreInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? GENRES.filter((g) => g.name.toLowerCase().includes(value.toLowerCase()))
    : GENRES;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <input
        placeholder="Genre"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-coven-amber placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-lavender"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 mt-1 w-full bg-coven-lavender border border-coven-amethyst rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((g) => (
            <li key={g.name}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-coven-amethyst flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(g.name);
                  setOpen(false);
                }}
              >
                <span>{g.emoji}</span>
                <span>{g.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── RankingPanel ──────────────────────────────────────────────────────────────

function RankingPanel({
  nominees,
  ranking,
  onSave,
}: {
  nominees: Book[];
  ranking: BookRanking;
  onSave: (ids: number[]) => Promise<void>;
}) {
  const [order, setOrder] = useState<number[]>(() => {
    const ranked = ranking.book_ids_ordered.filter((id) => nominees.some((b) => b.id === id));
    const unranked = nominees.filter((b) => !ranked.includes(b.id)).map((b) => b.id);
    return [...ranked, ...unranked];
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const bookMap = Object.fromEntries(nominees.map((b) => [b.id, b]));

  function handleDragStart(id: number) { dragItem.current = id; }
  function handleDragEnter(id: number) { dragOver.current = id; }

  function handleDrop() {
    if (dragItem.current === null || dragOver.current === null) return;
    const from = order.indexOf(dragItem.current);
    const to = order.indexOf(dragOver.current);
    if (from === to) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragItem.current);
    setOrder(next);
    dragItem.current = null;
    dragOver.current = null;
    setSaved(false);
  }

  function moveUp(id: number) {
    const idx = order.indexOf(id);
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
    setSaved(false);
  }

  function moveDown(id: number) {
    const idx = order.indexOf(id);
    if (idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(order);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">My Ranking</p>
          <p className="text-xs text-gray-400 mt-0.5">Drag or use arrows to rank books by preference. Used when creating a poll.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save ranking"}
        </button>
      </div>
      <ul className="space-y-1.5">
        {order.map((id, idx) => {
          const book = bookMap[id];
          if (!book) return null;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => handleDragStart(id)}
              onDragEnter={() => handleDragEnter(id)}
              onDragEnd={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-3 bg-app-raised border border-app-border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none"
            >
              <span className="text-xs font-bold text-gray-500 w-5 text-center">{idx + 1}</span>
              <span className="text-lg">{genreEmoji(book.genre)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{book.title}</p>
                <p className="text-xs text-gray-400 truncate">{book.author}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(id)}
                  disabled={idx === 0}
                  className="text-gray-500 hover:text-coven-lavender disabled:opacity-20 text-xs leading-none"
                >▲</button>
                <button
                  onClick={() => moveDown(id)}
                  disabled={idx === order.length - 1}
                  className="text-gray-500 hover:text-coven-lavender disabled:opacity-20 text-xs leading-none"
                >▼</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── BookCard ──────────────────────────────────────────────────────────────────

function BookCard({
  book,
  currentUserId,
  isAdmin,
  onVote,
  onDelete,
  onSetWinner,
}: {
  book: Book;
  currentUserId: number;
  isAdmin: boolean;
  onVote: (id: number) => void;
  onDelete: (id: number) => void;
  onSetWinner: (id: number) => void;
}) {
  const emoji = genreEmoji(book.genre);
  const isMine = book.suggested_by_id === currentUserId;

  return (
    <div
      className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${
        book.is_winner
          ? "border-coven-ember/40 bg-coven-ember/10"
          : "border-app-border bg-app-surface"
      }`}
    >
      <div className="text-xl shrink-0 mt-0.5">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-white">{book.title}</p>
          {book.is_winner && (
            <span className="text-xs bg-coven-ember text-white px-2 py-0.5 rounded-full shrink-0">Winner 🎉</span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-0.5">
          {book.author}
          {book.genre ? ` · ${book.genre}` : ""}
          {book.pages ? ` · ${book.pages} pages` : ""}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {book.vote_count} vote{book.vote_count !== 1 ? "s" : ""}
          {" · "}
          <span title={`Suggested by ${book.suggested_by_name}`}>
            {book.suggested_by_heart} {isMine ? "you" : book.suggested_by_name}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Vote = cast your personal vote for this book to influence the poll */}
        <button
          onClick={() => onVote(book.id)}
          title="Vote for this book — votes influence which books appear in the next poll"
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            book.user_voted
              ? "bg-coven-amethyst/30 text-coven-lavender hover:bg-coven-amethyst/40"
              : "bg-app-raised text-gray-400 hover:bg-app-border hover:text-white"
          }`}
        >
          {book.user_voted ? "Voted ✓" : "Vote"}
        </button>
        {/* Pick = admin marks this as the current club book */}
        {isAdmin && !book.is_winner && (
          <button
            onClick={() => onSetWinner(book.id)}
            title="Admin: mark this as the current club pick (the book you're reading now)"
            className="text-sm px-3 py-1.5 rounded-lg font-medium bg-app-raised text-gray-400 hover:bg-coven-ember/20 hover:text-coven-ember transition-colors"
          >
            Pick
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => onDelete(book.id)}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors px-1"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── BooksPage ─────────────────────────────────────────────────────────────────

export default function BooksPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [ranking, setRanking] = useState<BookRanking | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", genre: "", pages: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Book[]>("/books").then((r) => setBooks(r.data));
    api.get<BookRanking>("/books/my-ranking").then((r) => setRanking(r.data)).catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const titleLower = form.title.trim().toLowerCase();
    const dup = books.find((b) => b.title.toLowerCase() === titleLower);
    if (dup) {
      setError(`"${dup.title}" is already on the list.`);
      return;
    }

    try {
      const res = await api.post<Book>("/books", {
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre || null,
        pages: form.pages ? parseInt(form.pages) : null,
      });
      setBooks((prev) => [res.data, ...prev]);
      setForm({ title: "", author: "", genre: "", pages: "" });
      setShowForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to add book.");
    }
  }

  async function handleVote(bookId: number) {
    const res = await api.post<Book>(`/books/${bookId}/vote`);
    setBooks((prev) => prev.map((b) => (b.id === bookId ? res.data : b)));
  }

  async function handleDelete(bookId: number) {
    if (!confirm("Delete this book?")) return;
    await api.delete(`/books/${bookId}`);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  }

  async function handleSetWinner(bookId: number) {
    const res = await api.patch<Book>(`/books/${bookId}/winner`);
    setBooks((prev) => prev.map((b) => ({ ...b, is_winner: b.id === res.data.id })));
  }

  async function handleSaveRanking(ids: number[]) {
    const res = await api.put<BookRanking>("/books/my-ranking", { book_ids_ordered: ids });
    setRanking(res.data);
  }

  const winner = books.find((b) => b.is_winner);
  const nominees = books.filter((b) => !b.is_winner);
  const myBooks = nominees.filter((b) => b.suggested_by_id === user?.id);
  const othersBooks = nominees.filter((b) => b.suggested_by_id !== user?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-coven-gold">Books</h1>
        <div className="flex gap-2">
          {nominees.length > 0 && (
            <button
              onClick={() => setShowRanking((v) => !v)}
              className="text-sm px-4 py-2 rounded-lg border border-app-border text-coven-lavender hover:bg-app-raised transition-colors font-medium"
            >
              {showRanking ? "Hide ranking" : "My ranking"}
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "+ Suggest book"}
          </button>
        </div>
      </div>

      {/* Legend: what Vote and Pick mean */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span><span className="text-coven-lavender font-medium">Vote</span> — cast your vote for a book (influences poll selection)</span>
        {user?.club_role === "admin" && (
          <span><span className="text-coven-ember font-medium">Pick</span> — admin: mark as the book the club is currently reading</span>
        )}
      </div>

      {/* Add book form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-white">Suggest a book</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Title *"
              value={form.title}
              spellCheck
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember"
              required
            />
            <input
              placeholder="Author *"
              value={form.author}
              spellCheck
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className="border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember"
              required
            />
            <GenreInput value={form.genre} onChange={(v) => setForm((f) => ({ ...f, genre: v }))} />
            <input
              placeholder="Pages"
              type="number"
              value={form.pages}
              onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))}
              className="border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add book
          </button>
        </form>
      )}

      {/* Ranking panel */}
      {showRanking && ranking && nominees.length > 0 && (
        <RankingPanel nominees={nominees} ranking={ranking} onSave={handleSaveRanking} />
      )}

      {/* Current pick */}
      {winner && (
        <section>
          <p className="text-xs font-semibold text-coven-ember uppercase tracking-wide mb-2">Current pick</p>
          <BookCard
            book={winner}
            currentUserId={user?.id ?? 0}
            isAdmin={user?.club_role === "admin"}
            onVote={handleVote}
            onDelete={handleDelete}
            onSetWinner={handleSetWinner}
          />
        </section>
      )}

      {/* My suggested books */}
      {myBooks.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">My suggestions</p>
          <div className="space-y-3">
            {myBooks.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                currentUserId={user?.id ?? 0}
                isAdmin={user?.club_role === "admin"}
                onVote={handleVote}
                onDelete={handleDelete}
                onSetWinner={handleSetWinner}
              />
            ))}
          </div>
        </section>
      )}

      {/* Everyone else's suggestions */}
      {othersBooks.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {myBooks.length > 0 ? "The coven's suggestions" : "Nominees"}
          </p>
          <div className="space-y-3">
            {othersBooks.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                currentUserId={user?.id ?? 0}
                isAdmin={user?.club_role === "admin"}
                onVote={handleVote}
                onDelete={handleDelete}
                onSetWinner={handleSetWinner}
              />
            ))}
          </div>
        </section>
      )}

      {books.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-12">No books yet. Be the first to suggest one!</p>
      )}
    </div>
  );
}
