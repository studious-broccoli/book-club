import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Book } from "../types";

export default function BooksPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", genre: "", pages: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Book[]>("/books").then((r) => setBooks(r.data));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post<Book>("/books", {
        title: form.title,
        author: form.author,
        genre: form.genre || null,
        pages: form.pages ? parseInt(form.pages) : null,
      });
      setBooks((prev) => [res.data, ...prev]);
      setForm({ title: "", author: "", genre: "", pages: "" });
      setShowForm(false);
    } catch {
      setError("Failed to add book.");
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

  const winner = books.find((b) => b.is_winner);
  const nominees = books.filter((b) => !b.is_winner);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Books</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "+ Add book"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">New nomination</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
            <input
              placeholder="Author *"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              required
            />
            <input
              placeholder="Genre"
              value={form.genre}
              onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <input
              placeholder="Pages"
              type="number"
              value={form.pages}
              onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add book
          </button>
        </form>
      )}

      {winner && (
        <section>
          <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-2">Current pick</p>
          <BookCard
            book={winner}
            isAdmin={user?.role === "admin"}
            onVote={handleVote}
            onDelete={handleDelete}
            onSetWinner={handleSetWinner}
          />
        </section>
      )}

      {nominees.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Nominees</p>
          <div className="space-y-3">
            {nominees.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                isAdmin={user?.role === "admin"}
                onVote={handleVote}
                onDelete={handleDelete}
                onSetWinner={handleSetWinner}
              />
            ))}
          </div>
        </section>
      )}

      {books.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">No books yet. Add the first nomination!</p>
      )}
    </div>
  );
}

function BookCard({
  book,
  isAdmin,
  onVote,
  onDelete,
  onSetWinner,
}: {
  book: Book;
  isAdmin: boolean;
  onVote: (id: number) => void;
  onDelete: (id: number) => void;
  onSetWinner: (id: number) => void;
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${
        book.is_winner ? "border-purple-300 bg-purple-50" : "border-gray-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{book.title}</p>
          {book.is_winner && (
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full shrink-0">Winner</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {book.author}
          {book.genre ? ` · ${book.genre}` : ""}
          {book.pages ? ` · ${book.pages} pages` : ""}
        </p>
        <p className="text-xs text-gray-400 mt-1">{book.vote_count} vote{book.vote_count !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onVote(book.id)}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            book.user_voted
              ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {book.user_voted ? "Voted" : "Vote"}
        </button>
        {isAdmin && !book.is_winner && (
          <button
            onClick={() => onSetWinner(book.id)}
            className="text-sm px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition-colors"
          >
            Pick
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => onDelete(book.id)}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors px-1"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
