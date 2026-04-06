import React from "react";
import PoiForm from "./PoiForm";
import TrailForm from "./TrailForm";
import CategoryFilters from "./CategoryFilters";
import SidebarHeader from "./sidebar/SidebarHeader";
import SidebarActionButtons from "./sidebar/SidebarActionButtons";

export default function EditorSidebar({
  sidebarModel,
}) {
  const { ui, actions, poiForm, trailForm, filters } = sidebarModel;
  const { instructionMessage, mode, showForm, submitting } = ui;
  const { onStartAddPOI, onStartAddTrail, onCancelMode, onSubmit } = actions;

  return (
    <aside
      className="absolute top-6 left-6 w-80 max-h-[calc(100%-3rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      style={{ zIndex: 1000 }}
    >
      <SidebarHeader instructionMessage={instructionMessage} />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <SidebarActionButtons
          mode={mode}
          submitting={submitting}
          onStartAddPOI={onStartAddPOI}
          onStartAddTrail={onStartAddTrail}
          onCancelMode={onCancelMode}
        />

        {showForm && mode === "add-poi" && (
          <PoiForm
            editingPoiId={poiForm.editingPoiId}
            selectedLocation={poiForm.selectedLocation}
            setSelectedLocation={poiForm.setSelectedLocation}
            categories={poiForm.categories}
            categoryIconPathMap={poiForm.categoryIconPathMap}
            categoryColors={poiForm.categoryColors}
            formData={poiForm.formData}
            setFormData={poiForm.setFormData}
            submitting={submitting}
            onSubmit={onSubmit}
          />
        )}

        {showForm && mode === "add-trail" && (
          <TrailForm
            editingTrailId={trailForm.editingTrailId}
            drawnTrail={trailForm.drawnTrail}
            setTrailGeometry={trailForm.setTrailGeometry}
            formData={trailForm.formData}
            setFormData={trailForm.setFormData}
            selectedTrailStyle={trailForm.selectedTrailStyle}
            submitting={submitting}
            onSubmit={onSubmit}
          />
        )}

        {!mode && (
          <CategoryFilters
            categories={filters.categories}
            categoryFilters={filters.categoryFilters}
            categoryIconPathMap={filters.categoryIconPathMap}
            categoryColors={filters.categoryColors}
            allOn={filters.allOn}
            onToggleAll={filters.onToggleAll}
            onToggleCategory={filters.onToggleCategory}
          />
        )}
      </div>
    </aside>
  );
}
