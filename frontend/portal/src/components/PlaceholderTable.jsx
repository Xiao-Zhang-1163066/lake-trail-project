import React from "react";
export default function PlaceholderTable() {
  return (
    <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-3">Item {i + 1}</td>
              <td className="px-4 py-3">Trail Segment</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 ring-1 ring-inset ring-green-200">
                  Active
                </span>
              </td>
              <td className="px-4 py-3">2025-09-26</td>
              <td className="px-4 py-3 text-right">
                <button className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
