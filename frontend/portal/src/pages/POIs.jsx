import React from "react";
import PlaceholderTable from "../components/PlaceholderTable.jsx";
import PlaceholderForm from "../components/PlaceholderForm.jsx";

export default function POIs() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Admin</span>
        <span>›</span>
        <span className="text-gray-900 font-medium">POIs</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <PlaceholderTable />
        </div>
        <div className="lg:col-span-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium mb-3">Edit POI</div>
          <PlaceholderForm />
        </div>
      </div>
    </>
  );
}
