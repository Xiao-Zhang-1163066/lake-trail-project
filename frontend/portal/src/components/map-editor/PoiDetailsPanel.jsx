import React from "react";

export default function PoiDetailsPanel({
  activePoi,
  resolveCategoryLabel,
  poiDeletingId,
  onClose,
  onEdit,
  onDelete,
}) {
  if (!activePoi) return null;

  const hasValidCoords = () => {
    if (
      activePoi.lat === null ||
      activePoi.lat === undefined ||
      activePoi.lat === "" ||
      activePoi.lng === null ||
      activePoi.lng === undefined ||
      activePoi.lng === ""
    ) {
      return null;
    }
    const lat = Number(activePoi.lat);
    const lng = Number(activePoi.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  };

  const coords = hasValidCoords();

  return (
    <div
      className="absolute top-6 right-6 w-96 max-w-[90vw] z-[1010]"
      role="dialog"
      aria-label={`Details for ${activePoi.name}`}
    >
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-gray-900 z-10"
          aria-label="Close details"
        >
          ×
        </button>

        <div className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
              <span>{resolveCategoryLabel(activePoi.category)}</span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {activePoi.isPublic ? "Public" : "Hidden"}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{activePoi.name}</h3>
          </div>

          <p className="text-sm text-gray-600">
            {activePoi.description || "No description provided yet."}
          </p>

          <div className="space-y-2 text-xs text-gray-500">
            {coords && (
              <div>
                <span className="font-semibold text-gray-600">Location:</span>{" "}
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
            {activePoi.gmaps && (
              <a
                href={activePoi.gmaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700"
              >
                <span className="material-symbols-outlined text-base">map</span>
                Open in Google Maps
              </a>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed"
              disabled={poiDeletingId === activePoi.id}
            >
              Edit Point
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={poiDeletingId === activePoi.id}
            >
              {poiDeletingId === activePoi.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

