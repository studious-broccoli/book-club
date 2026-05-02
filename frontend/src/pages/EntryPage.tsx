import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ClubEntry, ClubMember } from "../types";

export default function EntryPage() {
  const { enterClub, selectUser } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [clubs, setClubs] = useState<ClubEntry[] | null>(null);
  const [selectedClub, setSelectedClub] = useState<ClubEntry | null>(null);
  // Member waiting for personal password entry
  const [pendingMember, setPendingMember] = useState<ClubMember | null>(null);
  const [userPassword, setUserPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await enterClub(password);
      setClubs(result);
      if (result.length === 1) {
        setSelectedClub(result[0]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError("Wrong password. Ask the admin for the club password.");
      } else {
        setError("Could not reach the server. Make sure the backend is running (start.ps1).");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMemberClick(member: ClubMember) {
    if (member.has_password) {
      setUserPassword("");
      setError("");
      setPendingMember(member);
    } else {
      handleSelect(member.user_id, selectedClub!.club_id);
    }
  }

  async function handleSelect(userId: number, clubId: number, pw?: string) {
    setError("");
    setLoading(true);
    try {
      await selectUser(userId, clubId, pw);
      navigate("/dashboard");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError("Wrong password.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMember || !selectedClub) return;
    await handleSelect(pendingMember.user_id, selectedClub.club_id, userPassword);
  }

  function handleBack() {
    if (pendingMember) {
      setPendingMember(null);
      setUserPassword("");
      setError("");
      return;
    }
    if (selectedClub && clubs && clubs.length > 1) {
      setSelectedClub(null);
    } else {
      setClubs(null);
      setSelectedClub(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Decorative stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-[12%] left-[8%] text-coven-gold text-xl animate-twinkle">✦</span>
        <span className="absolute top-[25%] right-[10%] text-coven-lavender text-sm animate-twinkle-slow">✦</span>
        <span className="absolute top-[60%] left-[15%] text-coven-ember text-xs animate-twinkle-fast">✦</span>
        <span className="absolute top-[75%] right-[20%] text-coven-gold text-base animate-twinkle">✦</span>
        <span className="absolute top-[40%] left-[5%] text-coven-silver text-xs animate-twinkle-slow">✦</span>
        <span className="absolute top-[85%] left-[60%] text-coven-lavender text-xs animate-twinkle-fast">✦</span>
        <span className="absolute top-[10%] right-[35%] text-coven-spelgold text-xs animate-twinkle">✦</span>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-sm p-8 relative z-10">
        {/* Logo / title */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2 animate-float">🔮</div>
          <h1 className="text-2xl font-bold text-coven-gold">The Spicy Book Coven</h1>
        </div>

        {/* Step 1: club password */}
        {clubs === null && (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">Enter the club password to get started</p>
            <form onSubmit={handleEnter} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Club password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-coven-amber placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-coven-dragon hover:bg-coven-flame text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Checking..." : "Enter"}
              </button>
            </form>
          </>
        )}

        {/* Step 2 (optional): pick a club */}
        {clubs !== null && clubs.length > 1 && selectedClub === null && (
          <>
            <p className="text-gray-400 text-sm mb-4 text-center">Which coven?</p>
            <div className="space-y-2">
              {clubs.map((club) => (
                <button
                  key={club.club_id}
                  onClick={() => setSelectedClub(club)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-app-border bg-app-raised hover:border-coven-ember hover:bg-app-border transition-colors text-left"
                >
                  <span className="font-medium text-white">{club.club_name}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {club.members.length} member{club.members.length !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={handleBack}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </>
        )}

        {/* Step 3: pick a member */}
        {selectedClub !== null && pendingMember === null && (
          <>
            <p className="text-coven-gold text-sm font-medium mb-1 text-center">{selectedClub.club_name}</p>
            <p className="text-gray-500 text-xs mb-5 text-center">Select your name</p>
            <div className="space-y-2">
              {selectedClub.members.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => handleMemberClick(m)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-app-border bg-app-raised hover:border-coven-ember hover:bg-app-border transition-colors text-left"
                >
                  <span className="text-xl">{m.heart_color}</span>
                  <span className="font-medium text-white">{m.display_name}</span>
                  {m.role === "admin" && (
                    <span className="ml-auto text-xs bg-coven-amethyst/20 text-coven-lavender px-2 py-0.5 rounded-full">
                      admin
                    </span>
                  )}
                  {m.has_password && m.role !== "admin" && (
                    <span className="ml-auto text-gray-600 text-xs">🔒</span>
                  )}
                  {m.has_password && m.role === "admin" && (
                    <span className="ml-1 text-gray-600 text-xs">🔒</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={handleBack}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </>
        )}

        {/* Step 4: personal password (only when member has one set) */}
        {pendingMember !== null && (
          <>
            <p className="text-coven-gold text-sm font-medium mb-1 text-center">
              {pendingMember.heart_color} {pendingMember.display_name}
            </p>
            <p className="text-gray-500 text-xs mb-5 text-center">Enter your password</p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-coven-amber placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember"
                placeholder="Password"
                required
                autoFocus
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-coven-dragon hover:bg-coven-flame text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Checking..." : "Sign in"}
              </button>
            </form>
            <button
              onClick={handleBack}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
