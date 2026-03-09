import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const LEGACY_ADMIN_KEY = import.meta.env.VITE_GALLERY_ADMIN_KEY || "";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Gallery() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const hasAdminAccess = Boolean(token || LEGACY_ADMIN_KEY);

  const authHeaders = useMemo(() => {
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        "X-Portal-Authorization": `Bearer ${token}`,
        "X-Auth-Token": token,
      };
    }
    if (LEGACY_ADMIN_KEY) {
      return { "X-Admin-Key": LEGACY_ADMIN_KEY };
    }
    return {};
  }, [token]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!hasAdminAccess) {
      setError("Admin access is required to view the gallery manager.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/gallery/admin/list`, {
        headers: { Accept: "application/json", ...authHeaders },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load gallery (${res.status})`);
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, hasAdminAccess]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!hasAdminAccess) {
      setStatus("Admin access is required to upload images.");
      return;
    }
    const form = event.currentTarget;
    const file = form.elements.file.files[0];
    const caption = form.elements.caption.value.trim();
    const uploader = form.elements.uploader.value.trim();

    if (!file) {
      setStatus("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus("Image is too large (max 5 MB).");
      return;
    }

    setUploading(true);
    setStatus("Uploading…");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${API_BASE}/gallery/admin/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          data: dataUrl,
          caption,
          uploader,
          source: "admin",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      form.reset();
      setStatus("Upload successful");
      fetchItems();
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!hasAdminAccess) {
      window.alert("Admin access is required to delete images.");
      return;
    }
    if (!window.confirm(`Delete "${item.caption || item.filename}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/gallery/admin/${item.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed (${res.status})`);
      }
      setItems((current) => current.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error(err);
      window.alert(err.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      {!hasAdminAccess && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign in to manage gallery content. Uploads and deletions require an authenticated admin session.
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Gallery Manager</h1>
            <p className="text-sm text-gray-500">
              Upload curated images and moderate community submissions.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload new photo</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleUpload}>
          <label className="sm:col-span-2 text-sm font-medium text-gray-700 flex flex-col gap-2">
            Image file
            <input
              type="file"
              name="file"
              accept="image/*"
              required
              className="file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-5 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700 placeholder:text-emerald-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              disabled={!hasAdminAccess || uploading}
            />
          </label>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Caption
            <input
              type="text"
              name="caption"
              placeholder="Sunrise over Kaituna Lagoon"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={!hasAdminAccess || uploading}
            />
          </label>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Photographer name
            <input
              type="text"
              name="uploader"
              placeholder="Jamie"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={!hasAdminAccess || uploading}
            />
          </label>
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300"
              disabled={!hasAdminAccess || uploading}
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <p className="text-sm text-gray-500 mt-2 sm:mt-0">
              {status || "Accepts JPG/PNG under 5 MB."}
            </p>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Gallery items</h2>
          <button
            type="button"
            onClick={fetchItems}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-500 text-sm">{error}</div>
        ) : !items.length ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            No images yet. Upload your first photo above.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid gap-4 px-6 py-4 sm:grid-cols-[120px_1fr_auto] sm:items-center"
              >
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    alt={item.caption || item.filename}
                    src={item.url}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.caption || item.filename}
                  </div>
                  <div className="text-xs text-gray-500 break-all">{item.filename}</div>
                  {item.uploader && (
                    <div className="text-xs text-gray-500">Credit: {item.uploader}</div>
                  )}
                  <div className="text-xs text-gray-400">
                    Uploaded {new Date(item.uploadedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-sm font-medium text-red-500 hover:text-red-600"
                    disabled={!hasAdminAccess}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
