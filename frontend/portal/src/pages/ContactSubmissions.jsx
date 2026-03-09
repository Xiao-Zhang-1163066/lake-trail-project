import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { API_BASE } from "../constants/api";

export default function ContactSubmissions() {
  // Get authentication token from context
  const { token, handleSessionExpired } = useAuth();

  // State management for submissions list
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // Filter options: "all", "new", "read", "responded", "archived"
  // State for managing the detail view modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if user is authenticated
  const isAuthenticated = Boolean(token);

  // Reuse the admin token across requests so Azure Static Web Apps passes it through.
  const authHeaders = useMemo(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      "X-Portal-Authorization": `Bearer ${token}`,
      "X-Auth-Token": token,
    };
  }, [token]);

  // Load the most recent submissions for admins; redirects to login on expired sessions.
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Return empty array if user is not authenticated
      if (!isAuthenticated) {
        setSubmissions([]);
        return [];
      }

      // Build query string based on the selected status filter
      let url = `${API_BASE}/contact/admin/submissions`;
      if (filter !== "all") {
        url += `?status=${filter}`;
      }
      // Make API request to fetch submissions
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
          `Failed to fetch submissions (${response.status})`;
        // Redirect to login if session has expired (401 Unauthorized)
        if (response.status === 401) {
          handleSessionExpired();
          return [];
        }
        throw new Error(message);
      }

      // Parse and validate response data
      const data = await response.json();
      const items = Array.isArray(data?.submissions) ? data.submissions : [];
      setSubmissions(items);
      return items;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch submissions");
      setSubmissions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [authHeaders, filter, handleSessionExpired, isAuthenticated]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Update the submission status and keep the modal in sync with the latest data.
  const handleStatusChange = useCallback(
    async (submissionId, newStatus) => {
      if (!isAuthenticated) {
        return;
      }

      try {
        // Send PATCH request to update submission status
        const response = await fetch(
          `${API_BASE}/contact/admin/submissions/${submissionId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...authHeaders,
            },
            body: JSON.stringify({ status: newStatus }),
          }
        );

        // Handle error responses
        if (!response.ok) {
          const message =
            (await response.text()) ||
            `Failed to update status (${response.status})`;
          if (response.status === 401) {
            handleSessionExpired();
            return;
          }
          throw new Error(message);
        }

        // Refresh submissions list to get updated data
        const updatedItems = await fetchSubmissions();
        // Update the selected submission in the modal with the latest data
        const updatedSubmission = updatedItems.find(
          (item) => item.id === submissionId
        );
        setSelectedSubmission(updatedSubmission || null);

        // Close the modal if status was changed to anything other than "read"
        if (newStatus !== "read") {
          setDialogOpen(false);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to update status");
      }
    },
    [authHeaders, fetchSubmissions, handleSessionExpired, isAuthenticated]
  );

  // Open the detail dialog and automatically mark new submissions as read.
  const handleViewSubmission = (submission) => {
    if (!isAuthenticated) {
      return;
    }

    setSelectedSubmission(submission);
    setDialogOpen(true);

    // Automatically mark new submissions as read when viewed
    if (submission.status === "new") {
      handleStatusChange(submission.id, "read");
    }
  };

  // Delete submission with browser confirm dialog
  const handleDeleteClick = useCallback(
    async (submission) => {
      if (!isAuthenticated) {
        return;
      }

      // Show browser confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to delete this submission from ${submission.name}?\n\nThis action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      try {
        // Send DELETE request to remove submission
        const response = await fetch(
          `${API_BASE}/contact/admin/submissions/${submission.id}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              ...authHeaders,
            },
          }
        );

        // Handle error responses
        if (!response.ok) {
          const message =
            (await response.text()) ||
            `Failed to delete submission (${response.status})`;
          if (response.status === 401) {
            handleSessionExpired();
            return;
          }
          throw new Error(message);
        }

        // Refresh submissions list
        await fetchSubmissions();

        // Close detail dialog if it was open for the deleted submission
        if (selectedSubmission?.id === submission.id) {
          setDialogOpen(false);
          setSelectedSubmission(null);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to delete submission");
      }
    },
    [
      authHeaders,
      fetchSubmissions,
      handleSessionExpired,
      isAuthenticated,
      selectedSubmission,
    ]
  );

  const getStatusClass = (status) => {
    const baseClass =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    switch (status) {
      case "new":
        return `${baseClass} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`;
      case "read":
        return `${baseClass} bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200`;
      case "responded":
        return `${baseClass} bg-green-50 text-green-700 ring-1 ring-inset ring-green-200`;
      case "archived":
        return `${baseClass} bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200`;
      default:
        return `${baseClass} bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200`;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Authentication warning banner */}
      {!isAuthenticated && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 py-3 text-sm text-amber-800">
          You need an active admin session to view contact submissions. Sign in
          again if you recently logged out.
        </div>
      )}

      {/* Error message banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Page header */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Contact Submissions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage inquiries and feedback from website visitors
        </p>
      </div>

      {/* Submissions table */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
        {/* Filter dropdown in table header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Submissions</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-select" className="text-sm text-gray-600">
              Show:
            </label>
            {/* Filter dropdown - allows filtering by submission status */}
            <select
              id="filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="responded">Responded</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {/* Table header */}
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Message Preview</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty state or submission rows */}
              {!submissions.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {isAuthenticated
                      ? "No submissions yet"
                      : "Sign in to load submissions"}
                  </td>
                </tr>
              ) : (
                // Map through submissions and render each row
                submissions.map((submission) => (
                  <tr key={submission.id} className="border-t border-gray-100">
                    {/* Submission date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(submission.created_at)}
                    </td>
                    {/* Submitter name */}
                    <td className="px-4 py-3">{submission.name}</td>
                    {/* Submitter email (clickable mailto link) */}
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${submission.email}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {submission.email}
                      </a>
                    </td>
                    {/* Message preview (truncated to 50 characters) */}
                    <td className="px-4 py-3 max-w-xs truncate">
                      {submission.message.substring(0, 50)}
                      {submission.message.length > 50 ? "..." : ""}
                    </td>
                    {/* Status badge with color coding */}
                    <td className="px-4 py-3">
                      <span className={getStatusClass(submission.status)}>
                        {submission.status}
                      </span>
                    </td>
                    {/* Action buttons */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* View button - opens modal with full details */}
                        <button
                          onClick={() => handleViewSubmission(submission)}
                          className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                          disabled={!isAuthenticated}
                        >
                          View
                        </button>
                        {/* Reply button - opens email client */}
                        <a
                          href={`mailto:${submission.email}?subject=Re: Your inquiry to Te Waihora Trail`}
                          className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          Reply
                        </a>
                        {/* Delete button - opens confirmation dialog */}
                        <button
                          onClick={() => handleDeleteClick(submission)}
                          className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                          disabled={!isAuthenticated}
                          title="Delete submission"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal/dialog - shown when viewing a submission */}
      {dialogOpen && selectedSubmission && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Contact Submission Details
              </h2>
            </div>

            {/* Modal content - submission details */}
            <div className="p-6 space-y-4">
              {/* Submission date */}
              <div>
                <div className="text-sm font-medium text-gray-500">Date</div>
                <div className="mt-1 text-gray-900">
                  {formatDate(selectedSubmission.created_at)}
                </div>
              </div>

              {/* Submitter name */}
              <div>
                <div className="text-sm font-medium text-gray-500">Name</div>
                <div className="mt-1 text-gray-900">
                  {selectedSubmission.name}
                </div>
              </div>

              {/* Submitter email */}
              <div>
                <div className="text-sm font-medium text-gray-500">Email</div>
                <div className="mt-1">
                  <a
                    href={`mailto:${selectedSubmission.email}`}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {selectedSubmission.email}
                  </a>
                </div>
              </div>

              {/* Full message text */}
              <div>
                <div className="text-sm font-medium text-gray-500">Message</div>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-900">
                  {selectedSubmission.message}
                </div>
              </div>

              {/* Status dropdown - allows changing the submission status */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={selectedSubmission.status}
                  onChange={(e) =>
                    handleStatusChange(selectedSubmission.id, e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={!isAuthenticated}
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="responded">Responded</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Modal footer with action buttons */}
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => handleDeleteClick(selectedSubmission)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                disabled={!isAuthenticated}
              >
                Delete
              </button>
              <div className="flex gap-3">
                {/* Close button */}
                <button
                  onClick={() => setDialogOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
                {/* Reply button - opens email client with pre-filled subject */}
                <a
                  href={`mailto:${selectedSubmission.email}?subject=Re: Your inquiry to Te Waihora Trail`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
