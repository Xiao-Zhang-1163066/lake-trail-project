import React from "react";
import { TRAIL_STATUS_OPTIONS } from "../../constants/trailStatuses";

export default function TrailForm({
  editingTrailId,
  drawnTrail,
  setTrailGeometry,
  formData,
  setFormData,
  selectedTrailStyle,
  submitting,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-200 pt-4">
      <div className="text-sm font-semibold text-gray-900">
        {editingTrailId ? "Edit Trail" : "New Trail"}
      </div>

      {!drawnTrail ? (
        <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
          {editingTrailId
            ? "Draw the updated path for this track using the tools on the map."
            : "Use the drawing tools on the map to draw your trail path"}
        </div>
      ) : (
        <div className="text-xs text-green-600 bg-green-50 p-3 rounded-lg border border-green-200 flex items-start justify-between">
          <div>
            {editingTrailId
              ? "Existing trail path loaded. Use Redraw to replace it."
              : "Trail path drawn successfully"}
          </div>
          <button
            type="button"
            onClick={() => setTrailGeometry(null)}
            className="text-green-700 hover:text-green-900 underline"
          >
            Redraw
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Trail Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Northern Section"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
        <select
          required
          value={formData.status}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              status: e.target.value,
            }))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TRAIL_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Style preview</span>
            <span>{selectedTrailStyle.label}</span>
          </div>
          <svg className="mt-2 h-3 w-full">
            <line
              x1="0"
              y1="6"
              x2="100%"
              y2="6"
              stroke={selectedTrailStyle.color}
              strokeWidth={selectedTrailStyle.weight}
              strokeDasharray={selectedTrailStyle.dashArray || undefined}
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-1 text-[11px] text-gray-500">
            {selectedTrailStyle.dashArray
              ? `Dashed pattern ${selectedTrailStyle.dashArray}`
              : "Solid line"}{" "}
            • Width {selectedTrailStyle.weight}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_public_trail"
          checked={formData.is_public}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              is_public: e.target.checked,
            }))
          }
          className="rounded border-gray-300"
        />
        <label htmlFor="is_public_trail" className="text-sm text-gray-700">
          Visible to public
        </label>
      </div>

      <button
        type="submit"
        disabled={!formData.name || !drawnTrail || submitting}
        className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed transition"
      >
        {submitting ? "Saving..." : editingTrailId ? "Update Trail" : "Save Trail"}
      </button>
    </form>
  );
}

