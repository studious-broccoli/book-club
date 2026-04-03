import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { ClubEntry } from "../types";

export default function Navbar() {
  const { user, logout, switchClub } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubEntry[]>([]);
  const [showClubMenu, setShowClubMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.get<ClubEntry[]>("/clubs").then((r) => setClubs(r.data)).catch(() => {});
    }
  }, [user?.club_id]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowClubMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    logout();
    navigate("/enter");
  }

  async function handleSwitchClub(clubId: number) {
    setShowClubMenu(false);
    await switchClub(clubId);
    navigate("/dashboard");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-coven-amethyst/20 text-coven-lavender"
        : "text-gray-400 hover:bg-app-raised hover:text-white"
    }`;

  const otherClubs = clubs.filter((c) => c.club_id !== user?.club_id);

  return (
    <nav className="bg-app-surface border-b border-app-border relative z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Club name / switcher */}
          <div className="relative mr-3" ref={menuRef}>
            <button
              onClick={() => otherClubs.length > 0 && setShowClubMenu((v) => !v)}
              className={`text-coven-gold font-bold text-base flex items-center gap-1 whitespace-nowrap ${
                otherClubs.length > 0 ? "hover:text-coven-spelgold cursor-pointer" : "cursor-default"
              }`}
            >
              {user?.club_name ?? "The Spicy Book Coven"}
              {otherClubs.length > 0 && (
                <span className="text-xs text-coven-gold/50">{showClubMenu ? "▲" : "▼"}</span>
              )}
            </button>
            {showClubMenu && otherClubs.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-app-surface border border-app-border rounded-xl shadow-2xl z-[200] min-w-48 py-1">
                <p className="text-xs text-gray-500 px-3 py-1.5 font-medium">Switch club</p>
                {otherClubs.map((c) => (
                  <button
                    key={c.club_id}
                    onClick={() => handleSwitchClub(c.club_id)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-app-raised hover:text-coven-gold transition-colors"
                  >
                    {c.club_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          <NavLink to="/books" className={linkClass}>Books</NavLink>
          <NavLink to="/schedule" className={linkClass}>Schedule</NavLink>
          <NavLink to="/availability" className={linkClass}>My Availability</NavLink>
          <NavLink to="/group-availability" className={linkClass}>Group</NavLink>
          {user?.club_role === "admin" && (
            <NavLink to="/members" className={linkClass}>Members</NavLink>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          {user && (
            <span className="text-sm text-coven-silver font-medium whitespace-nowrap">
              {user.display_name} {user.heart_color}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors whitespace-nowrap"
          >
            Switch user
          </button>
        </div>
      </div>
    </nav>
  );
}
