// src/pages/ProfilePage.jsx
// The logged-in person's profile. Right now it holds their profile
// picture: pick an image, upload it, and it shows in the sidebar
// (and anywhere else the avatar is used).

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { UserRound, Upload } from "lucide-react";
import api, { apiOrigin, errorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

// Role badge tones tuned for the light profile card.
const roleBadge = {
  admin: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  cashier: "bg-violet-50 text-violet-600 ring-violet-100",
  stock: "bg-emerald-50 text-emerald-600 ring-emerald-100",
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const initial = user && user.name ? user.name[0].toUpperCase() : "U";
  const avatarUrl = user && user.avatar;

  function onPickAvatar(e) {
    const f = e.target.files && e.target.files[0];
    if (f) setAvatarFile(f);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  }

  async function save() {
    if (!avatarFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", avatarFile);
      await api.post("/users/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAvatarFile(null);
      // Pull the fresh user (with the new avatar path) into context.
      await refreshUser();
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Profile" icon={UserRound}>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-bold text-white ring-1 ring-white/40">
            {avatarUrl ? (
              <img
                src={apiOrigin + avatarUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-slate-800">
              {user?.name ?? "User"}
            </p>
            <p className="text-sm text-slate-500">{user?.email ?? ""}</p>
            <span
              className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ${
                roleBadge[user?.role] ?? "bg-slate-100 text-slate-500 ring-slate-200"
              }`}
            >
              {user?.role ?? "user"}
            </span>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            PNG, JPG, GIF, WEBP or SVG, max 2 MB. Shown in the sidebar.
          </p>
          <input
            ref={fileRef}
            id="avatar-file"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={onPickAvatar}
            className="sr-only"
          />
          <div className="mt-3 flex items-center gap-3">
            <label
              htmlFor="avatar-file"
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Upload size={16} />
              Choose photo
            </label>
            <Button onClick={save} loading={saving} disabled={!avatarFile}>
              Update photo
            </Button>
            {avatarFile && (
              <p className="text-xs font-medium text-indigo-600">
                {avatarFile.name} ({Math.round(avatarFile.size / 1024)} KB)
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
