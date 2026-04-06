import React from "react";

export default function TrailDetailsPanel({
  activeTrail,
  activeTrailStyle,
  activeTrailAccent,
  trailDeletingId,
  onClose,
  onCenter,
  onEdit,
  onDelete,
}) {
  if (!activeTrail) return null;

  return (
    <div
      className="absolute top-6 right-6 w-96 max-w-[90vw] z-[1010]"
      role="dialog"
      aria-label={`Details for ${activeTrail.name}`}
    >
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl">
        <div
          className="relative h-16"
          style={{
            background: `linear-gradient(135deg, ${activeTrailAccent}, ${activeTrailAccent}33)`,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-between px-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/90">
              {activeTrailStyle?.label || activeTrail.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-gray-900"
              aria-label="Close details"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {activeTrail.isPublic ? "Public" : "Hidden"}
                </span>
              </div>
              <button
                type="button"
                onClick={onCenter}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Center map
              </button>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{activeTrail.name}</h3>
          </div>

          <p className="text-sm text-gray-600">
            {activeTrail.description || "No description provided yet."}
          </p>

          <div className="space-y-1 text-xs text-gray-500">
            <div>
              <span className="font-semibold text-gray-600">Status:</span>{" "}
              {activeTrailStyle?.label || activeTrail.status}
            </div>
            <div>
              <span className="font-semibold text-gray-600">Visibility:</span>{" "}
              {activeTrail.isPublic ? "Public" : "Hidden"}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed"
              disabled={trailDeletingId === activeTrail.id}
            >
              Edit Track
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={trailDeletingId === activeTrail.id}
            >
              {trailDeletingId === activeTrail.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

