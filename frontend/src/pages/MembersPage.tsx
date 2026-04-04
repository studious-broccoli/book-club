import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ClubEntry, UserOut } from "../types";

const inputCls = "border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember";

const emptyAddForm = { first_name: "", last_name: "", password: "", email: "" };

export default function MembersPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin";

  const [clubs, setClubs] = useState<ClubEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserOut[]>([]);

  // Collapsible sections
  const [showMasterList, setShowMasterList] = useState(true);
  const [collapsedClubs, setCollapsedClubs] = useState<Set<number>>(new Set());

  function toggleClub(clubId: number) {
    setCollapsedClubs((prev) => {
      const next = new Set(prev);
      next.has(clubId) ? next.delete(clubId) : next.add(clubId);
      return next;
    });
  }

  // Add-member state
  const [addingToClub, setAddingToClub] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [addError, setAddError] = useState("");

  // Create-club state
  const [showClubForm, setShowClubForm] = useState(false);
  const [clubForm, setClubForm] = useState({ name: "", password: "" });
  const [clubError, setClubError] = useState("");
  const [clubCreated, setClubCreated] = useState("");

  function refreshClubs() {
    api.get<ClubEntry[]>("/clubs").then((r) => setClubs(r.data));
  }

  useEffect(() => {
    refreshClubs();
    if (isGlobalAdmin) {
      api.get<UserOut[]>("/users").then((r) => setAllUsers(r.data)).catch(() => {});
    }
  }, [isGlobalAdmin]);

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault();
    setClubError("");
    setClubCreated("");
    try {
      await api.post("/clubs", { name: clubForm.name, password: clubForm.password });
      setClubCreated(`"${clubForm.name}" created! Share the password with members.`);
      setClubForm({ name: "", password: "" });
      setShowClubForm(false);
      refreshClubs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setClubError(msg ?? "Failed to create club.");
    }
  }

  async function handleDeleteClub(club: ClubEntry) {
    if (!confirm(`Delete "${club.club_name}" and all its data? This cannot be undone.`)) return;
    try {
      await api.delete(`/clubs/${club.club_id}`);
      refreshClubs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(msg ?? "Failed to delete club.");
    }
  }

  async function handleAddNew(e: React.FormEvent, clubId: number) {
    e.preventDefault();
    setAddError("");
    try {
      const username = `${addForm.first_name.toLowerCase()}.${addForm.last_name.toLowerCase()}`;
      const display_name = `${addForm.first_name} ${addForm.last_name}`;
      await api.post(`/clubs/${clubId}/members`, {
        username,
        display_name,
        password: addForm.password || null,
        email: addForm.email || null,
        role: "member",
      });
      closeAddForm();
      refreshClubs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAddError(msg ?? "Failed to add member.");
    }
  }

  async function handleAddExisting(clubId: number) {
    setAddError("");
    const u = allUsers.find((x) => x.id === selectedUserId);
    if (!u) { setAddError("Please select a member."); return; }
    try {
      const parts = u.username.split(".");
      const display_name = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      await api.post(`/clubs/${clubId}/members`, {
        username: u.username,
        display_name,
        password: null,
        email: null,
        role: "member",
      });
      closeAddForm();
      refreshClubs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAddError(msg ?? "Failed to add member.");
    }
  }

  async function handleRemoveMember(clubId: number, userId: number) {
    if (!confirm("Remove this member from the club?")) return;
    await api.delete(`/clubs/${clubId}/members/${userId}`);
    refreshClubs();
  }

  function openAddForm(clubId: number) {
    setAddingToClub(addingToClub === clubId ? null : clubId);
    setAddMode("new");
    setAddForm(emptyAddForm);
    setSelectedUserId(null);
    setAddError("");
  }

  function closeAddForm() {
    setAddingToClub(null);
    setAddForm(emptyAddForm);
    setSelectedUserId(null);
    setAddError("");
  }

  return (
    <div className="space-y-10">

      {/* ── All members (master list) ── */}
      <section>
        <button
          onClick={() => setShowMasterList((v) => !v)}
          className="w-full flex items-center justify-between group mb-1"
        >
          <h2 className="font-script text-4xl text-coven-mystic">The Spicy Book Coven</h2>
          <span className="text-gray-500 text-xs group-hover:text-gray-300 transition-colors">
            {showMasterList ? "▲ hide" : "▼ show"}
          </span>
        </button>
        <p className="text-gray-400 text-sm mb-4">All members across every book club.</p>
        {showMasterList && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allUsers.map((u) => {
              const name = u.username.includes(".")
                ? u.username.split(".").map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
                : u.username.charAt(0).toUpperCase() + u.username.slice(1);
              return (
                <div key={u.id} className="bg-app-surface border border-app-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">{u.heart_color}</span>
                  <div>
                    <span className="font-medium text-white text-sm">{name}</span>
                    {u.username.includes(".") && (
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    )}
                  </div>
                  {u.role === "admin" && (
                    <span className="ml-auto text-xs bg-coven-amethyst/20 text-coven-lavender px-2 py-0.5 rounded-full">
                      admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Create club ── */}
      {isGlobalAdmin && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-coven-gold">Book Clubs</h2>
              <p className="text-gray-400 text-sm mt-0.5">Create a new book club with its own member list.</p>
            </div>
            <button
              onClick={() => { setShowClubForm((v) => !v); setClubError(""); setClubCreated(""); }}
              className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {showClubForm ? "Cancel" : "+ New club"}
            </button>
          </div>

          {clubCreated && <p className="text-green-400 text-sm mb-3">{clubCreated}</p>}

          {showClubForm && (
            <form onSubmit={handleCreateClub} className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Club name *"
                  value={clubForm.name}
                  onChange={(e) => setClubForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  required
                />
                <input
                  placeholder="Club password *"
                  value={clubForm.password}
                  onChange={(e) => setClubForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              {clubError && <p className="text-red-400 text-sm">{clubError}</p>}
              <button type="submit" className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Create club
              </button>
            </form>
          )}
        </section>
      )}

      {/* ── Per-club sections ── */}
      {clubs.map((club) => {
        const memberIds = new Set(club.members.map((m) => m.user_id));
        const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

        const isCollapsed = collapsedClubs.has(club.club_id);

        return (
          <section key={club.club_id}>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => toggleClub(club.club_id)}
                className="flex items-center gap-3 group text-left"
              >
                <div>
                  <h1 className="text-2xl font-bold text-coven-gold group-hover:text-coven-spelgold transition-colors">
                    {club.club_name}
                  </h1>
                  <p className="text-gray-500 text-xs mt-0.5">{club.members.length} member{club.members.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-gray-500 text-xs group-hover:text-gray-300 transition-colors">
                  {isCollapsed ? "▼ show" : "▲ hide"}
                </span>
              </button>
              {isGlobalAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAddForm(club.club_id)}
                    className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {addingToClub === club.club_id ? "Cancel" : "+ Add member"}
                  </button>
                  <button
                    onClick={() => handleDeleteClub(club)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-2"
                    title="Delete club"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>

            {!isCollapsed && addingToClub === club.club_id && (
              <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4 mb-4">
                <h3 className="font-semibold text-white">Add member to {club.club_name}</h3>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  {(["new", "existing"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setAddMode(mode); setAddError(""); }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        addMode === mode
                          ? "bg-coven-amethyst/30 text-coven-lavender"
                          : "bg-app-raised text-gray-400 hover:text-white"
                      }`}
                    >
                      {mode === "new" ? "Create new member" : "Add existing member"}
                    </button>
                  ))}
                </div>

                {addMode === "new" ? (
                  <form onSubmit={(e) => handleAddNew(e, club.club_id)} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        placeholder="First name *"
                        value={addForm.first_name}
                        onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))}
                        className={inputCls}
                        required
                      />
                      <input
                        placeholder="Last name *"
                        value={addForm.last_name}
                        onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))}
                        className={inputCls}
                        required
                      />
                      <input
                        placeholder="Password *"
                        type="password"
                        value={addForm.password}
                        onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                        className={inputCls}
                        required
                      />
                      <input
                        placeholder="Email (optional)"
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    {addError && <p className="text-red-400 text-sm">{addError}</p>}
                    <button type="submit" className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      Add member
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {nonMembers.length === 0 ? (
                      <p className="text-gray-500 text-sm">All members are already in this club.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                          {nonMembers.map((u) => {
                            const displayName = u.username.split(".").map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                                  selectedUserId === u.id
                                    ? "border-coven-ember bg-coven-ember/10 text-white"
                                    : "border-app-border bg-app-raised text-gray-300 hover:border-coven-ember/40"
                                }`}
                              >
                                <span>{u.heart_color}</span>
                                <div>
                                  <p className="text-sm font-medium">{displayName}</p>
                                  <p className="text-xs text-gray-500">@{u.username}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {addError && <p className="text-red-400 text-sm">{addError}</p>}
                        <button
                          type="button"
                          onClick={() => handleAddExisting(club.club_id)}
                          disabled={!selectedUserId}
                          className="bg-coven-ember hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                        >
                          Add to {club.club_name}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Member list */}
            {!isCollapsed && (
              <div className="space-y-3">
                {club.members.map((m) => (
                  <div key={m.user_id} className="bg-app-surface border border-app-border rounded-xl px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl">{m.heart_color}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{m.display_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.role === "admin"
                            ? "bg-coven-amethyst/20 text-coven-lavender"
                            : "bg-app-raised text-gray-500"
                        }`}>
                          {m.role === "admin" ? "admin" : "member"}
                        </span>
                      </div>
                      {m.username.includes(".") && (
                        <p className="text-xs text-gray-500">@{m.username}</p>
                      )}
                    </div>
                    {isGlobalAdmin && m.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(club.club_id, m.user_id)}
                        className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
