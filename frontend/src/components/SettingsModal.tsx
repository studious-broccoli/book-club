import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const HEART_EMOJIS = ["💜", "💙", "💚", "💛", "🧡", "❤️", "🩷", "🩵", "💖", "💗"];

const inputCls = "w-full border border-app-border bg-app-raised rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coven-ember";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [heartColor, setHeartColor] = useState(user?.heart_color ?? "💜");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Password section
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.put("/auth/profile", {
        display_name: displayName,
        email: email || null,
        heart_color: heartColor,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post("/auth/me/password", {
        new_password: newPassword,
        current_password: user?.has_password ? currentPassword : null,
      });
      await refreshUser();
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setPasswordSaved(false); setShowPasswordSection(false); }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPasswordError(msg ?? "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleRemovePassword() {
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError("Enter your current password to remove it.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.delete("/auth/me/password", {
        data: { new_password: "", current_password: currentPassword },
      });
      await refreshUser();
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setPasswordSaved(false); setShowPasswordSection(false); }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPasswordError(msg ?? "Failed to remove password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-coven-gold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Display name <span className="text-gray-600">({user?.club_name})</span>
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Heart emoji</label>
            <div className="flex flex-wrap gap-2">
              {HEART_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setHeartColor(emoji)}
                  className={`text-xl w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    heartColor === emoji
                      ? "bg-coven-ember/30 ring-2 ring-coven-ember"
                      : "bg-app-raised hover:bg-app-border"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || saved}
              className="bg-coven-dragon hover:bg-coven-flame text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        {/* Password section */}
        <div className="mt-5 pt-5 border-t border-app-border">
          <button
            type="button"
            onClick={() => { setShowPasswordSection((v) => !v); setPasswordError(""); }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span>{showPasswordSection ? "▾" : "▸"}</span>
            <span>{user?.has_password ? "Change or remove password" : "Set a login password"}</span>
          </button>

          {showPasswordSection && (
            <form onSubmit={handlePasswordSave} className="mt-4 space-y-3">
              {user?.has_password && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputCls}
                    autoComplete="current-password"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  required
                />
              </div>

              {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
              {passwordSaved && <p className="text-green-400 text-sm">Password updated ✓</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={passwordSaving || passwordSaved}
                  className="bg-coven-dragon hover:bg-coven-flame text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  {passwordSaved ? "Saved ✓" : passwordSaving ? "Saving…" : user?.has_password ? "Update password" : "Set password"}
                </button>
                {user?.has_password && (
                  <button
                    type="button"
                    onClick={handleRemovePassword}
                    disabled={passwordSaving || passwordSaved}
                    className="text-sm text-gray-500 hover:text-red-400 transition-colors disabled:opacity-60"
                  >
                    Remove password
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
