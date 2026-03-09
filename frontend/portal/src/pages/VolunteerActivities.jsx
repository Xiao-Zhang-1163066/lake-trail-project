import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

const EVENT_FALLBACK_IMAGES = [
  "/gallery-media/IMG_1004.jpg",
  "/gallery-media/IMG_1354-2.jpg",
  "/gallery-media/update1.jpg",
  "/gallery-media/update2.jpg",
];

function formatDate(value) {
  if (!value) return "TBC";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (err) {
    return value;
  }
}

export default function VolunteerActivities() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      "X-Portal-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Auth-Token": token,
    };
  }, [token]);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/events`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load events (${res.status})`);
      }
      const data = await res.json();
      setEvents(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load events");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    if (!token) return;
    setLoadingRegistrations(true);
    try {
      const res = await fetch(`${API_BASE}/volunteers/me/registrations`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "X-Portal-Authorization": `Bearer ${token}`,
            "X-Auth-Token": token,
          },
        });
      if (!res.ok) {
        throw new Error(`Failed to load registrations (${res.status})`);
      }
      const data = await res.json();
      setRegistrations(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load your registrations");
    } finally {
      setLoadingRegistrations(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    if (isAdmin) {
      navigate("/volunteers", { replace: true });
    }
  }, [isAdmin, navigate]);

  if (isAdmin) {
    return null;
  }

  const registeredSet = useMemo(() => {
    const set = new Set();
    (registrations || []).forEach((item) => {
      if (item.eventId) {
        set.add(item.eventId);
      }
      if (item.eventTitle) {
        const match = (events || []).find((event) => event.title === item.eventTitle);
        if (match) {
          set.add(match.id);
        }
      }
    });
    return set;
  }, [registrations, events]);

  const handleRegister = async (eventItem) => {
    setActionMessage("");
    if (!token) {
      setError("Login required to register for events.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/volunteers/register`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: user?.name || "",
          email: user?.email || "",
          eventId: eventItem.id,
          eventTitle: eventItem.title,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Registration failed (${res.status})`);
      }
      setActionMessage("Registration received. We will be in touch soon.");
      setError('');
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to register for the event");
    }
  };

  const handleCancel = async (registration) => {
    setActionMessage("");
    if (!token) return;
    if (!window.confirm("Cancel your registration for this event?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/volunteers/me/registrations/${registration.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Portal-Authorization": `Bearer ${token}`,
            "X-Auth-Token": token,
          },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Unable to cancel (${res.status})`);
      }
      setActionMessage("Registration cancelled.");
      setError('');
      fetchRegistrations();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to cancel registration");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">Volunteer activities</h1>
        <p className="text-sm text-gray-600">
          Browse upcoming mahi days and register your interest. We'll email details once a coordinator confirms your spot.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming events</h2>
          {loadingEvents && (
            <span className="text-sm text-gray-500">Loading…</span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {events.length === 0 && !loadingEvents ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
              No events announced yet. Check back soon!
            </div>
          ) : null}
          {events.map((eventItem, index) => {
            const isRegistered = registeredSet.has(eventItem.id);
            const imageSrc =
              eventItem.imageUrl || EVENT_FALLBACK_IMAGES[index % EVENT_FALLBACK_IMAGES.length];
            return (
              <article
                key={eventItem.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={eventItem.title}
                    className="mb-4 h-40 w-full rounded-xl object-cover"
                  />
                ) : null}
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {formatDate(eventItem.date)}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900">
                  {eventItem.title || "Volunteer event"}
                </h3>
                {eventItem.description ? (
                  <p className="mt-2 text-sm text-gray-600">{eventItem.description}</p>
                ) : null}
                {eventItem.linkUrl ? (
                  <a
                    href={eventItem.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {eventItem.linkText || "Event details"} →
                  </a>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {isRegistered ? (
                    <>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Registered
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const registration =
                            registrations.find((r) => r.eventId === eventItem.id) ||
                            registrations.find(
                              (r) => r.eventTitle && r.eventTitle === eventItem.title
                            );
                          if (registration) handleCancel(registration);
                        }}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700"
                      >
                        Cancel registration
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRegister(eventItem)}
                      className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                    >
                      Register interest
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your registrations</h2>
          {loadingRegistrations && (
            <span className="text-sm text-gray-500">Loading…</span>
          )}
        </div>
        {registrations.length === 0 && !loadingRegistrations ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
            No registrations yet. Sign up for an activity above.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {registrations.map((item) => {
              const eventMatch =
                events.find((ev) => ev.id === item.eventId) ||
                events.find(
                  (ev) => ev.title === item.eventTitle && item.eventTitle
                );
              const eventDate = eventMatch?.date || item.createdAt;
              return (
                <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    {formatDate(eventDate)}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">
                    {item.eventTitle || eventMatch?.title || "Volunteer mahi"}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Submitted {formatDate(item.createdAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCancel(item)}
                    className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Cancel registration
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
