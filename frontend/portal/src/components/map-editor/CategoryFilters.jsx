import React from "react";
import { getAssetUrl } from "../../utils/mapEditor/assetUrl";

export default function CategoryFilters({
  categories,
  categoryFilters,
  categoryIconPathMap,
  categoryColors,
  allOn,
  onToggleAll,
  onToggleCategory,
}) {
  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Activities</h3>
        <button
          onClick={onToggleAll}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {allOn ? "Turn off all" : "Turn on all"}
        </button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => {
          const slug = category.slug || category.icon || String(category.id);
          const iconPath =
            categoryIconPathMap[slug] ||
            getAssetUrl("/assets/icons/categories/default.svg");
          const accent = categoryColors[slug] || "#1fa74d";

          return (
            <label
              key={category.id}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white cursor-pointer transition-all"
              style={{
                borderColor: categoryFilters[slug] ? accent : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-full"
                  style={{
                    border: `2px solid ${accent}`,
                    background: categoryFilters[slug] ? `${accent}20` : "white",
                  }}
                >
                  <img
                    src={iconPath}
                    alt={category.label}
                    style={{ width: "20px", height: "20px" }}
                    onError={(e) => {
                      e.target.src = getAssetUrl("/assets/icons/categories/default.svg");
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {category.label}
                </span>
              </div>
              <input
                type="checkbox"
                checked={categoryFilters[slug] || false}
                onChange={() => onToggleCategory(slug)}
                className="rounded border-gray-300 focus:ring-green-500"
                style={{ accentColor: accent }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

