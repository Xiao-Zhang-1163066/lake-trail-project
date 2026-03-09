import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { API_BASE } from "../constants/api";

export default function NewsletterSubscribers() {
  // Get authentication token from context
  const { token, handleSessionExpired } = useAuth();

  // State management for subscriber list and UI
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("active"); // Filter options: "all", "active", "unsubscribed"
  const [copySuccess, setCopySuccess] = useState(false); // Track successful copy operation

  // Check if user is authenticated
  const isAuthenticated = Boolean(token);

  // Create authorization headers for API requests
  // Reuses the admin token across requests for Azure Static Web Apps

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      "X-Portal-Authorization": `Bearer ${token}`,
      "X-Auth-Token": token,
    };
  }, [token]);

  //  Fetch newsletter subscribers from the API
  //  Builds query string based on the selected status filter
  //  Handles authentication errors and redirects to login if session expired

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Build query string based on the selected status filter
      let url = `${API_BASE}/newsletter/admin/subscribers`;
      if (filter === "active") {
        url += "?active=true";
      } else if (filter === "unsubscribed") {
        url += "?active=false";
      }
      // No query string is appended when "all" is selected

      // Return empty array if user is not authenticated
      if (!isAuthenticated) {
        setSubscribers([]);
        return;
      }

      // Make API request to fetch subscribers
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...authHeaders,
        },
      });

      // Handle error responses
      if (!response.ok) {
        const message =
          (await response.text()) ||
          `Failed to fetch subscribers (${response.status})`;
        // Redirect to login if session has expired (401 Unauthorized)
        if (response.status === 401) {
          handleSessionExpired();
          return;
        }
        throw new Error(message);
      }

      // Parse and set subscriber data
      const data = await response.json();
      setSubscribers(data.subscribers || []);
    } catch (err) {
      console.error(err);
      setSubscribers([]);
      setError(err.message || "Failed to fetch subscribers");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, filter, handleSessionExpired, isAuthenticated]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  /**
   * Export subscriber data to CSV file
   * Creates a CSV with headers and downloads it with a timestamped filename
   */
  const exportToCSV = () => {
    if (!subscribers.length) {
      return;
    }

    // Define CSV headers
    const headers = [
      "Email",
      "Name",
      "Status",
      "Subscribed Date",
      "Unsubscribed Date",
    ];

    // Map subscriber data to CSV rows
    const rows = subscribers.map((sub) => [
      sub.email,
      sub.name || "",
      sub.is_active ? "Active" : "Unsubscribed",
      new Date(sub.subscribed_at).toLocaleString(),
      sub.unsubscribed_at ? new Date(sub.unsubscribed_at).toLocaleString() : "",
    ]);

    // Combine headers and rows into CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /**
   * Copy active subscriber emails to clipboard
   * Formats emails as comma-separated list for Gmail BCC field
   * Shows temporary success feedback and logs count for verification
   */
  const copyEmailsToClipboard = async () => {
    try {
      // Only copy addresses for active subscribers
      const activeEmails = subscribers
        .filter((sub) => sub.is_active)
        .map((sub) => sub.email)
        .join(", ");

      if (!activeEmails) {
        alert("No active subscribers to copy");
        return;
      }

      // Copy to clipboard using the Clipboard API
      await navigator.clipboard.writeText(activeEmails);

      // Show a temporary success state on the button
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);

      // Log summary information to aid manual verification
      const count = subscribers.filter((sub) => sub.is_active).length;
      console.log(`Copied ${count} active subscriber emails to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard. Please try again.");
    }
  };

  // Format date string to human-readable format

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Calculate statistics for active and unsubscribed counts
  const activeCount = subscribers.filter((s) => s.is_active).length;
  const unsubscribedCount = subscribers.filter((s) => !s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Authentication warning banner */}
      {!isAuthenticated && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 py-3 text-sm text-amber-800">
          You need an active admin session to view newsletter subscribers. Sign
          in again if your session expired.
        </div>
      )}

      {/* Error message banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Page header with action buttons */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Newsletter Subscribers
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage newsletter subscription list
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Emails button - copies active emails for Gmail BCC */}
            <button
              onClick={copyEmailsToClipboard}
              className={
                copySuccess
                  ? "inline-flex items-center justify-center rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600 transition-colors"
                  : "inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
              }
              title="Copy active subscriber emails (comma-separated for Gmail BCC)"
              disabled={!isAuthenticated || !subscribers.length}
            >
              {copySuccess ? "Copied!" : "Copy Emails"}
            </button>
            {/* Export CSV button - downloads all subscriber data */}
            <button
              onClick={exportToCSV}
              className="inline-flex items-center justify-center rounded-full border border-gray-900 bg-transparent px-5 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              disabled={!isAuthenticated || !subscribers.length}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Subscribers table */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        {/* Filter dropdown in table header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Subscribers</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-select" className="text-sm text-gray-600">
              Show:
            </label>
            {/* Filter dropdown - allows filtering by subscription status */}
            <select
              id="filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* Table header */}
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subscribed Date</th>
                <th className="px-4 py-3 font-medium">Unsubscribed Date</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty state or subscriber rows */}
              {subscribers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {isAuthenticated
                      ? "No subscribers yet"
                      : "Sign in to load subscribers"}
                  </td>
                </tr>
              ) : (
                // Map through subscribers and render each row
                subscribers.map((subscriber) => (
                  <tr key={subscriber.id} className="border-t border-gray-100">
                    {/* Subscriber email */}
                    <td className="px-4 py-3">{subscriber.email}</td>
                    {/* Subscriber name (or dash if not provided) */}
                    <td className="px-4 py-3">{subscriber.name || "-"}</td>
                    {/* Status badge with color coding */}
                    <td className="px-4 py-3">
                      <span
                        className={
                          subscriber.is_active
                            ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                            : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200"
                        }
                      >
                        {subscriber.is_active ? "Active" : "Unsubscribed"}
                      </span>
                    </td>
                    {/* Subscription date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(subscriber.subscribed_at)}
                    </td>
                    {/* Unsubscription date (or dash if still active) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {subscriber.unsubscribed_at
                        ? formatDate(subscriber.unsubscribed_at)
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with statistics */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex justify-between items-center text-sm text-gray-500">
          <div>
            Total: {subscribers.length} subscriber
            {subscribers.length !== 1 ? "s" : ""}
          </div>
          <div>Active: {activeCount}</div>
        </div>
      </div>

      {/* Help text - Quick instructions for sending newsletter via Gmail */}
      {activeCount > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Quick Gmail Send Instructions
              </h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Click "Copy Emails" button above</li>
                <li>Open Gmail and click "Compose"</li>
                <li>Click "BCC" (Blind Carbon Copy)</li>
                <li>Paste the copied emails (Cmd+V / Ctrl+V)</li>
                <li>Put your own email in "To" field</li>
                <li>Write your newsletter and send!</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2">
                Gmail limit: 500 emails/day. Currently {activeCount} active
                subscribers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
