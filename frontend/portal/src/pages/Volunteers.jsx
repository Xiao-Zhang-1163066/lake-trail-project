import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
const LEGACY_ADMIN_KEY =
  import.meta.env.VITE_VOLUNTEER_ADMIN_KEY ||
  import.meta.env.VITE_GALLERY_ADMIN_KEY ||
  "";

const MAX_EVENT_IMAGE_SIZE = 5 * 1024 * 1024;
const EVENT_FALLBACK_IMAGES = [
  "/gallery-media/IMG_1004.jpg",
  "/gallery-media/IMG_1354-2.jpg",
  "/gallery-media/update1.jpg",
  "/gallery-media/update2.jpg",
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildMailto(item) {
  if (!item.email) return undefined;
  const subjectParts = ["Te Waihora Trail – Volunteer"];
  if (item.eventTitle) {
    subjectParts.push(item.eventTitle);
  }
  const subject = encodeURIComponent(subjectParts.join(" | "));
  const bodyLines = [
    item.name ? `Kia ora ${item.name},` : "Kia ora,",
    "",
    "Thank you for registering your interest to support Te Waihora Trail.",
  ];
  if (item.eventTitle) {
    bodyLines.push(`Event: ${item.eventTitle}`);
  }
  if (item.notes) {
    bodyLines.push("", "Notes you shared:", item.notes);
  }
  bodyLines.push(
    "",
    "We'll be in touch with next steps. Ngā mihi,",
    "Te Waihora Trail Team"
  );
  const body = encodeURIComponent(bodyLines.join("\n"));
  return `mailto:${item.email}?subject=${subject}&body=${body}`;
}

function VolunteerRow({ group }) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const latestSubmission = group.submissions[0] || {};
  const mailto = buildMailto({
    name: group.name,
    email: group.email,
    notes: group.notes,
    eventTitle: latestSubmission.eventTitle,
  });
  const eventEntries = group.submissions.filter((entry) => entry.eventTitle);
  const hasGeneralInterest = group.submissions.some((entry) => !entry.eventTitle);
  const submittedText = group.latestCreatedAt
    ? new Date(group.latestCreatedAt).toLocaleString()
    : "—";

  const visibleEvents = showAllEvents ? eventEntries : eventEntries.slice(0, 3);
  const hasHiddenEvents = eventEntries.length > 3;

  return (
    <tr className="border-b last:border-0">
      <td className="px-6 py-3 text-sm font-medium text-gray-900 capitalize">
        {group.name || "—"}
      </td>
      <td className="px-6 py-3 text-sm">
        {mailto ? (
          <a
            href={mailto}
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            {group.email}
          </a>
        ) : (
          <span className="text-gray-600">{group.email || "—"}</span>
        )}
      </td>
      <td className="px-6 py-3 text-sm text-gray-600">{group.phone || "—"}</td>
      <td className="px-6 py-3 text-sm text-gray-600">
        <div className="flex flex-col gap-2">
          {eventEntries.length > 0 ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {eventEntries.length} event{eventEntries.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {visibleEvents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleEvents.map((entry, index) => (
                <a
                  key={entry.id || `${group.email}-${index}`}
                  href={`/volunteer.html#${entry.eventId || "general"}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {entry.eventTitle}
                </a>
              ))}
            </div>
          ) : null}
          {hasHiddenEvents ? (
            <button
              type="button"
              className="self-start text-left text-xs font-medium text-emerald-600 hover:text-emerald-700"
              onClick={() => setShowAllEvents((prev) => !prev)}
            >
              {showAllEvents ? "Show fewer" : `Show ${eventEntries.length - 3} more`}
            </button>
          ) : null}
          {eventEntries.length === 0 && !hasGeneralInterest ? "—" : null}
        </div>
      </td>
      <td className="px-6 py-3 text-xs text-gray-500">{submittedText}</td>
    </tr>
  );
}

export default function Volunteers() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const emptyEvent = {
    id: "",
    title: "",
    date: "",
    description: "",
    linkText: "",
    linkUrl: "",
    imageUrl: "",
  };
  const [events, setEvents] = useState([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  const groupedVolunteers = useMemo(() => {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = (item.email || "").toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          email: item.email || "",
          name: item.name || "",
          phone: item.phone || "",
          notes: item.notes || "",
          latestCreatedAt: item.createdAt || null,
          submissions: [],
        });
      }
      const group = map.get(key);
      const createdAt = item.createdAt || null;
      if (createdAt) {
        const current = group.latestCreatedAt
          ? new Date(group.latestCreatedAt).getTime()
          : 0;
        const incoming = new Date(createdAt).getTime();
        if (incoming >= current) {
          group.name = item.name || group.name || "";
          group.phone = item.phone || group.phone || "";
          group.notes = item.notes || group.notes || "";
          group.latestCreatedAt = createdAt;
        }
      }
      group.submissions.push({
        id: item.id,
        eventTitle: item.eventTitle || "",
        eventId: item.eventId || "",
        createdAt: item.createdAt || null,
      });
    });
    return Array.from(map.values())
      .map((group) => {
        group.submissions.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        return group;
      })
      .sort((a, b) => {
        const aTime = a.latestCreatedAt ? new Date(a.latestCreatedAt).getTime() : 0;
        const bTime = b.latestCreatedAt ? new Date(b.latestCreatedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [items]);
  const [eventListError, setEventListError] = useState("");
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [eventImagePreview, setEventImagePreview] = useState("");

  useEffect(() => {
    return () => {
      if (eventImagePreview && eventImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(eventImagePreview);
      }
    };
  }, [eventImagePreview]);

  const hasAdminAccess = Boolean(token || LEGACY_ADMIN_KEY);

  const headers = useMemo(() => {
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

  const loadVolunteers = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!hasAdminAccess) {
      setError("Admin access is required to view volunteers.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/volunteers/admin/list`, {
        headers: { Accept: "application/json", ...headers },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load volunteers");
    } finally {
      setLoading(false);
    }
  }, [hasAdminAccess, headers]);

  const loadEvents = useCallback(async () => {
    setEventLoading(true);
    setEventListError("");
    if (!hasAdminAccess) {
      setEventListError("Admin access is required to manage events.");
      setEventLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/volunteers/admin/events`, {
        headers: { Accept: "application/json", ...headers },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setEvents(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setEventListError(err.message || "Unable to load events");
    } finally {
      setEventLoading(false);
    }
  }, [hasAdminAccess, headers]);

  const handleEventChange = (event) => {
    const { name, value } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
  };

  const clearEventImageSelection = useCallback(() => {
    setEventImageFile(null);
    setEventImagePreview((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    setEventForm((prev) => ({ ...prev, imageUrl: "" }));
  }, []);

  const handleEventImageSelect = (event) => {
    const file = event.target.files?.[0];
    clearEventImageSelection();
    if (!file) return;
    if (file.size > MAX_EVENT_IMAGE_SIZE) {
      setEventError("Image is too large (max 5 MB).");
      event.target.value = "";
      return;
    }
    setEventImageFile(file);
    setEventImagePreview(URL.createObjectURL(file));
  };

  const handleEventEdit = (eventItem) => {
    setEventForm({
      id: eventItem.id || "",
      title: eventItem.title || "",
      date: (eventItem.date || "").slice(0, 10),
      description: eventItem.description || "",
      linkText: eventItem.linkText || "",
      linkUrl: eventItem.linkUrl || "",
      imageUrl: eventItem.imageUrl || "",
    });
    setEventImageFile(null);
    setEventImagePreview(eventItem.imageUrl || "");
    setEventError("");
  };

  const resetEventForm = () => {
    setEventForm(emptyEvent);
    setEventError("");
    if (eventImagePreview && eventImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(eventImagePreview);
    }
    setEventImageFile(null);
    setEventImagePreview("");
  };

  const handleEventSubmit = async (event) => {
    event.preventDefault();
    if (!hasAdminAccess) {
      setEventError("Admin access is required to manage events.");
      return;
    }
    if (!eventForm.title.trim() || !eventForm.date.trim()) {
      setEventError("Title and date are required.");
      return;
    }
    setEventError("");
    let imageUrl = eventForm.imageUrl.trim();
    if (eventImageFile) {
      try {
        const dataUrl = await readFileAsDataUrl(eventImageFile);
        const uploadRes = await fetch(
          `${API_BASE}/volunteers/admin/events/upload-image`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              filename: eventImageFile.name,
              contentType: eventImageFile.type,
              data: dataUrl,
            }),
          }
        );
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(text || `Image upload failed (${uploadRes.status})`);
        }
        const uploadData = await uploadRes.json();
        imageUrl = uploadData?.asset?.url || "";
      } catch (err) {
        console.error(err);
        setEventError(err.message || "Unable to upload image.");
        return;
      }
    }
    const payload = {
      title: eventForm.title.trim(),
      date: eventForm.date.trim(),
      description: eventForm.description.trim(),
      linkText: eventForm.linkText.trim(),
      linkUrl: eventForm.linkUrl.trim(),
      imageUrl,
    };
    const method = eventForm.id ? "PUT" : "POST";
    const url = eventForm.id
      ? `${API_BASE}/volunteers/admin/events/${eventForm.id}`
      : `${API_BASE}/volunteers/admin/events`;
    setEventSubmitting(true);
    setEventError("");
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      resetEventForm();
      loadEvents();
    } catch (err) {
      console.error(err);
      setEventError(err.message || "Unable to save event.");
    } finally {
      setEventSubmitting(false);
    }
  };

  const handleEventDelete = async (eventItem) => {
    if (!hasAdminAccess) {
      setEventError("Admin access is required to delete events.");
      return;
    }
    if (!window.confirm(`Delete "${eventItem.title}"?`)) {
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/volunteers/admin/events/${eventItem.id}`,
        {
          method: "DELETE",
          headers,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed (${res.status})`);
      }
      if (eventForm.id === eventItem.id) {
        resetEventForm();
      }
      loadEvents();
    } catch (err) {
      console.error(err);
      window.alert(err.message || "Unable to delete event");
    }
  };

  useEffect(() => {
    loadVolunteers();
    loadEvents();
  }, [loadEvents, loadVolunteers]);

  return (
    <div className="space-y-6">
      {!hasAdminAccess && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
          You need an active admin session to view volunteer submissions. Sign in again if you recently logged out.
        </div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Volunteer Registrations</h1>
            <p className="text-sm text-gray-500">
              View recent volunteer enquiries submitted from the public site.
            </p>
          </div>
          <button
            type="button"
            onClick={loadVolunteers}
            className="inline-flex items-center rounded-full border border-emerald-200 px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            Loading volunteers…
          </div>
        ) : error ? (
          <div className="px-6 py-6 text-center text-sm text-red-500">
            {error}
          </div>
        ) : !groupedVolunteers.length ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No registrations yet. Share the volunteer link to receive enquiries.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">
                      Last submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedVolunteers.map((group) => (
                    <VolunteerRow key={group.email} group={group} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 text-xs text-gray-500">
              Total: {groupedVolunteers.length} volunteer{groupedVolunteers.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900">Manage Volunteer Events</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add, edit, and remove the events shown on the public volunteer page.
          </p>
        </div>

        <form className="grid gap-4 px-6 py-5 sm:grid-cols-2" onSubmit={handleEventSubmit}>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Title
            <input
              type="text"
              name="title"
              value={eventForm.title}
              onChange={handleEventChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
              disabled={!hasAdminAccess || eventSubmitting}
            />
          </label>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
            Date
            <input
              type="date"
              name="date"
              value={eventForm.date}
              onChange={handleEventChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
              disabled={!hasAdminAccess || eventSubmitting}
            />
          </label>
          <label className="text-sm font-medium text-gray-700 flex flex-col gap-2 sm:col-span-2">
            Description
            <textarea
              name="description"
              rows={3}
              value={eventForm.description}
              onChange={handleEventChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={!hasAdminAccess || eventSubmitting}
            />
          </label>
          <div className="sm:col-span-2 grid gap-3">
            <label className="text-sm font-medium text-gray-700 flex flex-col gap-2">
              Feature image
              <input
                type="file"
                accept="image/*"
                onChange={handleEventImageSelect}
                disabled={!hasAdminAccess || eventSubmitting}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-6 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
              />
              <span className="text-xs text-gray-500">
                Upload JPG/PNG up to 5 MB. This image appears on the volunteer activities page.
              </span>
            </label>
            {eventImagePreview ? (
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <img
                  src={eventImagePreview}
                  alt="Selected preview"
                  className="h-20 w-32 rounded-lg object-cover"
                />
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  <span>{eventImageFile?.name || "Current image"}</span>
                  <button
                    type="button"
                    onClick={clearEventImageSelection}
                    className="self-start text-sm font-medium text-gray-600 hover:text-gray-800"
                    disabled={!hasAdminAccess || eventSubmitting}
                  >
                    Remove image
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300"
              disabled={!hasAdminAccess || eventSubmitting}
            >
              {eventSubmitting ? "Saving…" : eventForm.id ? "Update event" : "Add event"}
            </button>
            {eventForm.id && (
              <button
                type="button"
                onClick={resetEventForm}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel edit
              </button>
            )}
            {eventError && (
              <span className="text-sm text-red-500">{eventError}</span>
            )}
          </div>
        </form>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
          {eventLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-6 text-center text-sm text-gray-500">
              Loading events…
            </div>
          ) : eventListError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-6 text-center text-sm text-red-600">
              {eventListError}
            </div>
          ) : !events.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-6 text-center text-sm text-gray-500">
              No volunteer events yet. Add one using the form above.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
{events.map((eventItem, index) => {
  const previewSrc =
    eventItem.imageUrl || EVENT_FALLBACK_IMAGES[index % EVENT_FALLBACK_IMAGES.length];
  return (
    <li
      key={eventItem.id}
      className="grid gap-4 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-start"
    >
      <div className="h-24 w-36 overflow-hidden rounded-lg bg-gray-100">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={eventItem.title}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-900">
          {eventItem.title}
        </div>
        <div className="text-xs text-gray-500">
          {new Date(eventItem.date).toLocaleDateString()}
        </div>
        {eventItem.description ? (
          <p className="text-sm text-gray-600">
            {eventItem.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-3 sm:flex-col sm:items-end sm:justify-start">
        <button
          type="button"
          onClick={() => handleEventEdit(eventItem)}
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
          disabled={!hasAdminAccess}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => handleEventDelete(eventItem)}
          className="text-sm font-medium text-red-500 hover:text-red-600"
          disabled={!hasAdminAccess}
        >
          Delete
        </button>
      </div>
    </li>
  );
})}

            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
