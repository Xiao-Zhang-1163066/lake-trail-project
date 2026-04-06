import React from "react";
import { getAssetUrl } from "../../utils/mapEditor/assetUrl";

export default function PoiForm({
  editingPoiId,
  selectedLocation,
  setSelectedLocation,
  categories,
  categoryIconPathMap,
  categoryColors,
  formData,
  setFormData,
  submitting,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-gray-200 pt-4">
      <div className="text-sm font-semibold text-gray-900">
        {editingPoiId ? "Edit Point" : "New Point"}
      </div>

      <div className="mb-2">
        {selectedLocation ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-green-900 mb-1">
                  Location Confirmed
                </div>
                <div className="text-xs text-green-700">
                  {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocation(null)}
                className="text-green-700 hover:text-green-900 underline text-xs font-semibold"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            Click on the map to choose a location for this point.
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose Icon (Category) *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => {
            const slug = cat.slug || cat.icon || String(cat.id);
            const iconPath =
              categoryIconPathMap[cat.id] ||
              categoryIconPathMap[slug] ||
              getAssetUrl("/assets/icons/categories/default.svg");
            const accent = categoryColors[slug] || "#1fa74d";
            const isSelected = formData.category_id === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    category_id: cat.id,
                  }))
                }
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                title={cat.label}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center"
                  style={{
                    border: `2px solid ${isSelected ? accent : "#e5e7eb"}`,
                    borderRadius: "50%",
                    background: isSelected ? `${accent}20` : "white",
                  }}
                >
                  <img
                    src={iconPath}
                    alt={cat.label}
                    style={{
                      width: "18px",
                      height: "18px",
                      filter: isSelected ? "none" : "grayscale(60%) opacity(60%)",
                    }}
                    onError={(e) => {
                      e.target.src = getAssetUrl("/assets/icons/categories/default.svg");
                    }}
                  />
                </div>
                <span className="text-xs text-gray-600 text-center leading-tight">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
        {!formData.category_id && (
          <p className="mt-1 text-xs text-red-500">Please select a category</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Title of the point"
        />
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
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Optional description..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_public_poi"
          checked={formData.is_public}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              is_public: e.target.checked,
            }))
          }
          className="rounded border-gray-300"
        />
        <label htmlFor="is_public_poi" className="text-sm text-gray-700">
          Visible to public
        </label>
      </div>

      <button
        type="submit"
        disabled={!formData.category_id || !formData.name || !selectedLocation || submitting}
        className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed transition"
      >
        {submitting ? "Saving..." : editingPoiId ? "Update" : "Save"}
      </button>
    </form>
  );
}

