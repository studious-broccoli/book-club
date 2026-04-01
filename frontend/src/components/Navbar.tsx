import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/enter");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-purple-100 text-purple-700"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-purple-700 font-bold text-lg mr-4">Sister Book Club</span>
          <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          <NavLink to="/books" className={linkClass}>Books</NavLink>
          <NavLink to="/schedule" className={linkClass}>Schedule</NavLink>
          {user?.role === "admin" && (
            <NavLink to="/members" className={linkClass}>Members</NavLink>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-gray-700 font-medium">
              Hi {user.username}! {user.heart_color}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Switch user
          </button>
        </div>
      </div>
    </nav>
  );
}
