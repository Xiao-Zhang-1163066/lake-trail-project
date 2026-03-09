import React from "react";
export default function PlaceholderForm() {
  return (
    <form className="space-y-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Title</label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Trail section title"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Category</label>
        <select className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option>POI</option>
          <option>Amenity</option>
          <option>Alert</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <textarea
          rows={4}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Notes, instructions, safety info…"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Autosaves coming soon</div>
        <div className="space-x-2">
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
