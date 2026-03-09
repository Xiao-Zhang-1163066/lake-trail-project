import React, { useState, useEffect } from "react";
import {
  DEFAULT_TRAIL_STATUS,
  TRAIL_STATUS_OPTIONS,
  getStatusStyle,
} from "../constants/trailStatuses";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

export default function TrailManager() {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    status: DEFAULT_TRAIL_STATUS,
    description: "",
    legend_label: "",
    is_public: true,
    geojson: "",
  });
  const selectedStatusStyle = getStatusStyle(formData.status);

  useEffect(() => {
    loadTrails();
  }, []);

  const loadTrails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/public/trails`);
      const data = await response.json();

      setTrails(data.segments || []);
    } catch (error) {
      console.error("Failed to load trails:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (trail) => {
    setFormData({
      name: trail.name || "",
      status: trail.status || DEFAULT_TRAIL_STATUS,
      description: trail.description || "",
      legend_label: trail.legendLabel || "",
      is_public: trail.isPublic !== false,
      geojson: JSON.stringify(trail.geojson, null, 2) || "",
    });
    setSelectedTrail(trail);
    setIsEditing(true);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setFormData({
      name: "",
      status: DEFAULT_TRAIL_STATUS,
      description: "",
      legend_label: "",
      is_public: true,
      geojson: "",
    });
    setSelectedTrail(null);
    setIsEditing(false);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setSelectedTrail(null);
    setIsEditing(false);
    setShowAddForm(false);
    setFormData({
      name: "",
      status: DEFAULT_TRAIL_STATUS,
      description: "",
      legend_label: "",
      is_public: true,
      geojson: "",
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate GeoJSON
    if (formData.geojson) {
      try {
        JSON.parse(formData.geojson);
      } catch (err) {
        alert("Invalid GeoJSON format");
        return;
      }
    }

    // TODO: Implement API call to save trail
    console.log("Saving trail:", formData);
    alert("Trail save functionality will be implemented with backend API");
    handleCancel();
  };

  const handleDelete = async (trail) => {
    if (!confirm(`Are you sure you want to delete "${trail.name}"?`)) {
      return;
    }
    // TODO: Implement API call to delete trail
    console.log("Deleting trail:", trail);
    alert("Trail delete functionality will be implemented with backend API");
  };

  const getStatusBadge = (status) => {
    const statusStyle = getStatusStyle(status);
    const badgeClasses = {
      "stage-1": "bg-blue-50 text-blue-700 ring-blue-200",
      "stage-2": "bg-indigo-50 text-indigo-700 ring-indigo-200",
      existing: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
    const className =
      badgeClasses[status] || "bg-gray-100 text-gray-700 ring-gray-200";

    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${className}`}
      >
        {statusStyle.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-500">Loading trails...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Trail List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trail Sections</h2>
          <button
            onClick={handleAdd}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            + Add Track
          </button>
        </div>

        <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Legend Label</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {trails.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No trail sections found. Click "Add Track" to create one.
                  </td>
                </tr>
              ) : (
                trails.map((trail) => (
                  <tr key={trail.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-1 rounded"
                          style={{
                            backgroundColor: trail.style?.color || "#3B82F6",
                            borderStyle: trail.style?.dashArray
                              ? "dashed"
                              : "solid",
                          }}
                        />
                        <span className="font-medium">{trail.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(trail.status)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {trail.legendLabel || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset " +
                          (trail.isPublic
                            ? "bg-green-50 text-green-700 ring-green-200"
                            : "bg-gray-50 text-gray-600 ring-gray-200")
                        }
                      >
                        {trail.isPublic ? "Public" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(trail)}
                        className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(trail)}
                        className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Form */}
      <div className="lg:col-span-1">
        {(isEditing || showAddForm) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sticky top-20">
            <div className="text-sm font-medium mb-4">
              {isEditing ? "Edit Trail Section" : "Add New Track"}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Northern Section"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {TRAIL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Style preview</span>
                    <span>{selectedStatusStyle.label}</span>
                  </div>
                  <svg className="mt-2 h-3 w-full">
                    <line
                      x1="0"
                      y1="6"
                      x2="100%"
                      y2="6"
                      stroke={selectedStatusStyle.color}
                      strokeWidth={selectedStatusStyle.weight}
                      strokeDasharray={
                        selectedStatusStyle.dashArray || undefined
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {selectedStatusStyle.dashArray
                      ? `Dashed pattern ${selectedStatusStyle.dashArray}`
                      : "Solid line"}{" "}
                    • Width {selectedStatusStyle.weight}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Trail section details..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  GeoJSON <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="geojson"
                  value={formData.geojson}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder='{"type": "LineString", "coordinates": [[lng, lat], ...]}'
                />
                <p className="mt-1 text-xs text-gray-500">
                  Valid GeoJSON LineString or MultiLineString
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <label htmlFor="is_public" className="text-sm text-gray-600">
                  Visible to public
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {!isEditing && !showAddForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium mb-2">Quick Tips</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Click "Edit" to modify a trail section</li>
              <li>• Use "Add Track" to create new sections</li>
              <li>• Toggle visibility to hide/show on public map</li>
              <li>• Set status to track construction progress</li>
              <li>• Use GeoJSON to define the trail path</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
