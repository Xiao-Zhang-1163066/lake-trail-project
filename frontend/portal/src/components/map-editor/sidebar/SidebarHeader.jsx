import React from "react";

export default function SidebarHeader({ instructionMessage }) {
  return (
    <div className="p-5 border-b border-gray-200">
      <h2 className="text-lg font-bold text-gray-900">Map Editor</h2>
      <p id="map-instruction" className="text-sm text-gray-500 mt-1">
        {instructionMessage}
      </p>
    </div>
  );
}

