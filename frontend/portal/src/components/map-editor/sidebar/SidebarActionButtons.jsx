import React from "react";

export default function SidebarActionButtons({
  mode,
  submitting,
  onStartAddPOI,
  onStartAddTrail,
  onCancelMode,
}) {
  if (!mode) {
    return (
      <div className="space-y-2">
        <button
          onClick={onStartAddPOI}
          className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition disabled:bg-emerald-300"
          disabled={submitting}
        >
          Add a Point
        </button>
        <button
          onClick={onStartAddTrail}
          className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition disabled:bg-emerald-300"
          disabled={submitting}
        >
          Add a Track
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onCancelMode}
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
    >
      ← Cancel
    </button>
  );
}

