import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard.jsx";
import DashboardCard from "../components/DashboardCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { API_BASE } from "../constants/api";

const INITIAL_STATS = {
  pois: null,
  volunteers: null,
  gallery: null,
  newsletter: null,
  contact: null,
  updates: null,
};

export default function Dashboard() {
  const { user, token, handleSessionExpired } = useAuth();
  const role = user?.role || "volunteer";

  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = useMemo(() => {
    if (!token) {
      return {};
    }
    return {
      Authorization: `Bearer ${token}`,
      "X-Portal-Authorization": `Bearer ${token}`,
      "X-Auth-Token": token,
    };
  }, [token]);

  useEffect(() => {
    if (role !== "admin" || !token) {
      return;
    }

    let cancelled = false;

    const fetchJson = async (url, requiresAuth = false) => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(requiresAuth ? authHeaders : {}),
        },
      });

      if (!response.ok) {
        const message =
          (await response.text()) || `Request failed (${response.status})`;

        if (response.status === 401) {
          handleSessionExpired();
          return null;
        }

        throw new Error(message);
      }

      return response.json();
    };

    const loadStats = async () => {
      setLoading(true);
      setError("");

      try {
        const [
          poisData,
          volunteersData,
          galleryData,
          newsletterData,
          contactData,
          updatesData,
        ] = await Promise.all([
          fetchJson(`${API_BASE}/public/pois`),
          fetchJson(`${API_BASE}/volunteers/admin/list`, true),
          fetchJson(`${API_BASE}/gallery/admin/list`, true),
          fetchJson(`${API_BASE}/newsletter/admin/subscribers`, true),
          fetchJson(`${API_BASE}/contact/admin/submissions`, true),
          fetchJson(`${API_BASE}/updates/admin`, true),
        ]);

        if (cancelled) {
          return;
        }

        setStats({
          pois: Array.isArray(poisData?.pois) ? poisData.pois.length : 0,
          volunteers: Array.isArray(volunteersData?.items)
            ? volunteersData.items.length
            : 0,
          gallery: Array.isArray(galleryData?.items)
            ? galleryData.items.length
            : 0,
          newsletter: Array.isArray(newsletterData?.subscribers)
            ? newsletterData.subscribers.length
            : 0,
          contact: Array.isArray(contactData?.submissions)
            ? contactData.submissions.length
            : 0,
          updates: Array.isArray(updatesData?.items)
            ? updatesData.items.length
            : 0,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load dashboard stats.");
          setStats({ ...INITIAL_STATS });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [authHeaders, handleSessionExpired, role, token]);

  const formatCount = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Intl.NumberFormat().format(value);
    }
    return loading ? "…" : "—";
  };

  if (role !== "admin") {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Kia ora {user?.name || user?.email}
          </h1>
          <p className="text-sm text-gray-600">
            Welcome to the volunteer portal. Head to activities to register for
            upcoming mahi days and keep your profile up to date.
          </p>
        </header>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Get started</h2>
          <p className="mt-1 text-sm text-gray-600">
            Browse upcoming volunteer events and let the team know when you can
            help.
          </p>
          <Link
            to="/activities"
            className="mt-4 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            View activities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Welcome back, {user?.name || user?.email}
            </p>
          </div>
        </div>
        <p className="text-base text-gray-600">
          Overview of key portal metrics and system statistics. Click any card
          to manage that section.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">
                Error loading dashboard
              </h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Map Editor Card */}
        <DashboardCard
          to="/edit-map"
          title="Map Editor"
          value={formatCount(stats.pois)}
          description="Total Points of Interest"
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          }
        />

        {/* Volunteers Card */}
        <DashboardCard
          to="/volunteers"
          title="Volunteers"
          value={formatCount(stats.volunteers)}
          description="Registered volunteers"
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        />

        {/* Gallery Card */}
        <DashboardCard
          to="/gallery"
          title="Gallery"
          value={formatCount(stats.gallery)}
          description="Published gallery images"
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
        />

        {/* Newsletter Card */}
        <DashboardCard
          to="/newsletter"
          title="Newsletter"
          value={formatCount(stats.newsletter)}
          description="Active subscribers"
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          }
        />

        {/* Contact Submissions Card */}
        <DashboardCard
          to="/contact"
          title="Contact Submissions"
          value={formatCount(stats.contact)}
          description="Messages received"
          iconBgColor="bg-rose-100"
          iconColor="text-rose-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          }
        />

        {/* Project Updates Card */}
        <DashboardCard
          to="/content"
          title="Project Updates"
          value={formatCount(stats.updates)}
          description="Published articles"
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          }
        />
      </div>
    </div>
  );
}
