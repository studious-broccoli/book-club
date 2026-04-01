import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { User } from "../types";

export default function EntryPage() {
  const { enterClub, selectUser } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const list = await enterClub(password);
      setMembers(list);
    } catch {
      setError("Wrong password. Ask the admin for the club password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(userId: number) {
    await selectUser(userId);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Sister Book Club</h1>

        {members === null ? (
          <>
            <p className="text-gray-500 text-sm mb-6">Enter the club password to get started</p>
            <form onSubmit={handleEnter} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Club password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Checking..." : "Enter"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">Select your name</p>
            <div className="space-y-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                >
                  <span className="text-xl">{m.heart_color}</span>
                  <span className="font-medium text-gray-800">{m.username}</span>
                  {m.role === "admin" && (
                    <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      admin
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMembers(null)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
