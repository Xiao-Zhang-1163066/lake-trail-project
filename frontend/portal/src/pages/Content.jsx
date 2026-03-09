import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const EMPTY_FORM = {
  title: "",
  summary: "",
  detail: "",
  category: "",
  imageUrl: "",
  linkUrl: "",
  isPublished: true,
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function Content() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM }));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      "X-Portal-Authorization": `Bearer ${token}`,
      "X-Auth-Token": token,
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/updates/admin`, {
        headers: {
          Accept: "application/json",
          ...authHeaders,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load updates (${res.status})`);
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load updates.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const clearImageSelection = useCallback(() => {
    setImageFile(null);
    setImagePreview("");
  }, []);

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    clearImageSelection();
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setStatus("Image is too large (max 5 MB).");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setForm(() => ({ ...EMPTY_FORM }));
    clearImageSelection();
    setStatus("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("Saving…");
    try {
      let imageUrl = form.imageUrl.trim();
      if (imageFile) {
        setStatus("Uploading image…");
        const dataUrl = await readFileAsDataUrl(imageFile);
        const uploadRes = await fetch(`${API_BASE}/updates/admin/upload-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            filename: imageFile.name,
            contentType: imageFile.type,
            data: dataUrl,
          }),
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(text || `Image upload failed (${uploadRes.status})`);
        }
        const uploadData = await uploadRes.json();
        imageUrl = uploadData?.asset?.url || "";
        setStatus("Saving…");
      }
      if (!imageUrl) {
        throw new Error("Please upload a feature image.");
      }
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        detail: form.detail.trim(),
        category: form.category.trim(),
        imageUrl,
        linkUrl: form.linkUrl.trim(),
        isPublished: form.isPublished,
      };
      if (!payload.title) {
        throw new Error("Title is required.");
      }
      const res = await fetch(`${API_BASE}/updates/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to create update (${res.status})`);
      }
      const data = await res.json();
      const newItem = data?.item;
      setItems((current) =>
        newItem ? [newItem, ...current] : current
      );
      resetForm();
      setStatus("Update saved.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/updates/admin/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ isPublished: !item.isPublished }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to update status (${res.status})`);
      }
      const data = await res.json();
      const updated = data?.item;
      if (updated) {
        setItems((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry))
        );
      }
    } catch (err) {
      console.error(err);
      window.alert(err.message || "Failed to change publish status.");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete update "${item.title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/updates/admin/${item.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to delete (${res.status})`);
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (err) {
      console.error(err);
      window.alert(err.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Project Updates
            </h1>
            <p className="text-sm text-gray-500">
              Share progress highlights with the public site. Published updates appear immediately.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Add a new update
        </h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="sm:col-span-2 text-sm font-medium text-gray-700 flex flex-col gap-2">
            Title
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Boardwalk progress milestone"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-700 flex flex-col gap-2">
            Summary
            <textarea
              name="summary"
              rows={3}
              value={form.summary}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Brief description shown on the public site."
            />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-700 flex flex-col gap-2">
            Detailed content
            <textarea
              name="detail"
              rows={5}
              value={form.detail}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Full story shown on the update detail page."
            />
          </label>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Category
            <input
              type="text"
              name="category"
              value={form.category}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Construction, Community…"
            />
          </label>
          <div className="sm:col-span-2 grid gap-3">
            <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
              Feature image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                required={!imageFile}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
              />
              <span className="text-xs text-gray-500">
                Upload JPG or PNG up to 5 MB. This image appears on the public site.
              </span>
            </label>
            {imagePreview ? (
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <img
                  src={imagePreview}
                  alt="Selected preview"
                  className="h-20 w-32 rounded-lg object-cover"
                />
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  <span>{imageFile?.name}</span>
                  <button
                    type="button"
                    onClick={clearImageSelection}
                    className="self-start text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Link URL
            <input
              type="url"
              name="linkUrl"
              value={form.linkUrl}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional read-more link"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="isPublished"
              checked={form.isPublished}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
            />
            Publish immediately
          </label>
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save update"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="mt-2 sm:mt-0 text-sm text-gray-500 hover:text-gray-700"
              disabled={submitting}
            >
              Clear form
            </button>
            <span className="mt-2 sm:mt-0 text-sm text-gray-500">
              {status || "All fields can be edited later."}
            </span>
          </div>
        </form>
      </div>

  <div className="rounded-2xl bg-white shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent updates</h2>
          <button
            onClick={fetchUpdates}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-gray-500">Loading updates…</div>
        ) : error ? (
          <div className="px-6 py-6 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-500">
            No updates yet. Add your first project update above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Published
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Updated
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {item.title || "Untitled"}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {item.summary || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.category || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset " +
                          (item.isPublished
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-gray-100 text-gray-600 ring-gray-300")
                        }
                      >
                        {item.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDateTime(item.updatedAt || item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleTogglePublish(item)}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        {item.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
