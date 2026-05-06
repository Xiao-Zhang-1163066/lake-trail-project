import React, { useCallback, useRef, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./map-editor/mapEditor.css";
import { useAuth } from "../contexts/AuthContext";
import EditorSidebar from "./map-editor/EditorSidebar";
import TrailDetailsPanel from "./map-editor/TrailDetailsPanel";
import PoiDetailsPanel from "./map-editor/PoiDetailsPanel";
import { useLeafletEditor } from "../hooks/map-editor/useLeafletEditor";
import { useMapEditorUiState } from "../hooks/map-editor/useMapEditorUiState";
import { useRenderMapLayers } from "../hooks/map-editor/useRenderMapLayers";
import { useMapData } from "../hooks/map-editor/useMapData";
import { cloneGeoJSON, mergeGeoJsonItems } from "../utils/mapEditor/geojson";
import {
  removePoi,
  removeTrail,
  upsertPoi,
  upsertTrail,
} from "../services/mapAdminApi";
import {
  DEFAULT_TRAIL_STATUS,
  getStatusStyle,
} from "../constants/trailStatuses";
import { categoryColors } from "../constants/poiCategories";

export default function InteractiveMapEditor() {
  const { token, handleSessionExpired } = useAuth();

  // ── Server data ──────────────────────────────────────────────────────────────
  const {
    pois,
    trails,
    trailLegendItems,
    categories,
    loading,
    categoryFilters,
    setCategoryFilters,
    categoryIconPathMap,
    categoryIdMap,
    loadMapData,
  } = useMapData();

  // ── Editor UI state ──────────────────────────────────────────────────────────
  const {
    mode,
    setMode,
    drawnTrail,
    setDrawnTrail,
    activePoiId,
    setActivePoiId,
    editingPoiId,
    setEditingPoiId,
    poiDeletingId,
    setPoiDeletingId,
    activeTrailId,
    setActiveTrailId,
    editingTrailId,
    setEditingTrailId,
    trailDeletingId,
    setTrailDeletingId,
    selectedLocation,
    setSelectedLocation,
    submitting,
    setSubmitting,
    formData,
    setFormData,
    patchUiState,
  } = useMapEditorUiState();

  // ── Derived state ────────────────────────────────────────────────────────────
  const showForm = mode !== null;

  // Store minimum in state (ids), derive full objects here
  const activePoi = useMemo(
    () => pois.find((p) => p.id === activePoiId) ?? null,
    [pois, activePoiId],
  );
  const activeTrail = useMemo(
    () => trails.find((t) => t.id === activeTrailId) ?? null,
    [trails, activeTrailId],
  );

  // Hooks expect full objects, state stores ids — these adapt between the two
  const setActivePoi = useCallback(
    (poi) => setActivePoiId(poi?.id ?? null),
    [setActivePoiId],
  );
  const setActiveTrail = useCallback(
    (trail) => setActiveTrailId(trail?.id ?? null),
    [setActiveTrailId],
  );

  // ── Leaflet imperative handles ───────────────────────────────────────────────
  const mapRef = useRef(null); // the DOM node Leaflet renders into
  const mapInstanceRef = useRef(null); // the Leaflet map object
  const leafletRef = useRef(null); // the Leaflet library (L)
  const drawControlRef = useRef(null); // the draw toolbar control
  const drawnLayersRef = useRef(null); // FeatureGroup holding drawn shapes
  const currentDrawnLayerRef = useRef(null); // the most recently drawn layer
  const legendControlRef = useRef(null); // the legend Leaflet control
  const legendContainerRef = useRef(null); // the DOM node inside the legend

  // ── Leaflet geometry helpers ─────────────────────────────────────────────────
  // takes a GeoJSON object, clears the drawn layers, and redraws it on the map. Used when editing an existing trail — you load its saved geometry onto the map so the user can modify it.
  const setTrailGeometry = useCallback(
    (geojson) => {
      const normalized = cloneGeoJSON(geojson);
      if (drawnLayersRef.current) drawnLayersRef.current.clearLayers(); // Clear existing drawn layers before adding the new one
      currentDrawnLayerRef.current = null;
      setDrawnTrail(normalized);

      if (
        !normalized ||
        !leafletRef.current ||
        !drawnLayersRef.current ||
        !mapInstanceRef.current
      ) {
        return;
      }

      const L = leafletRef.current;
      const geoLayer = L.geoJSON(normalized);
      geoLayer.eachLayer((child) => {
        drawnLayersRef.current.addLayer(child);
        currentDrawnLayerRef.current = child;
      });

      try {
        const bounds = geoLayer.getBounds();
        if (bounds?.isValid())
          mapInstanceRef.current.fitBounds(bounds.pad(0.08));
      } catch (error) {
        console.warn("Unable to fit map to trail geometry", error);
      }
    },
    [setDrawnTrail],
  );

  // just pans and zooms to a trail's bounds without touching the drawn layers. Used when clicking "centre" on the trail detail panel.
  const focusTrailOnMap = useCallback((trail) => {
    if (!trail?.geojson || !leafletRef.current || !mapInstanceRef.current)
      return;
    try {
      const bounds = leafletRef.current.geoJSON(trail.geojson).getBounds();
      if (bounds?.isValid()) mapInstanceRef.current.fitBounds(bounds.pad(0.08));
    } catch (error) {
      console.warn("Unable to focus trail on map", error);
    }
  }, []);

  const rebuildDrawnTrailFromLayers = useCallback(() => {
    if (!drawnLayersRef.current) {
      setDrawnTrail(null);
      return null;
    }

    const geojsonItems = (drawnLayersRef.current.getLayers?.() || [])
      .map((layer) => {
        try {
          return layer.toGeoJSON?.();
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const merged = mergeGeoJsonItems(geojsonItems);
    setDrawnTrail(merged || null);
    return merged;
  }, [setDrawnTrail]);

  // ── Hooks: Leaflet init + layer rendering

  useLeafletEditor({
    mapRef,
    mapInstanceRef,
    leafletRef,
    drawControlRef,
    drawnLayersRef,
    currentDrawnLayerRef,
    legendControlRef,
    legendContainerRef,
    mode,
    trailStatus: formData.status,
    activePoi,
    setActivePoi,
    setActiveTrail,
    setSelectedLocation,
    rebuildDrawnTrailFromLayers,
  });

  useRenderMapLayers({
    mapInstanceRef,
    drawnLayersRef,
    legendContainerRef,
    pois,
    trails,
    categoryFilters,
    selectedLocation,
    categoryIconPathMap,
    trailLegendItems,
    activeTrail,
    mode,
    setActivePoi,
    setEditingPoiId,
    setActiveTrail,
    setMode,
    setSelectedLocation,
    setEditingTrailId,
    setTrailGeometry,
    setTrailDeletingId,
  });

  // ── Derived values ───────────────────────────────────────────────────────────
  const selectedTrailStyle = getStatusStyle(formData.status);
  const activeTrailStyle = activeTrail
    ? getStatusStyle(activeTrail.status)
    : null;
  const activeTrailAccent = activeTrailStyle?.color || "#2563eb";

  const categoryLabelMap = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      const slug = cat.slug || cat.icon || String(cat.id);
      map[slug] = cat.label;
      map[String(cat.id)] = cat.label;
    });
    return map;
  }, [categories]);

  const resolveCategoryLabel = useCallback(
    (value) =>
      categoryLabelMap[value] ||
      categoryLabelMap[String(value)] ||
      value ||
      "—",
    [categoryLabelMap],
  );

  // ── Mode transition handlers ─────────────────────────────────────────────────
  const handleCancelMode = useCallback(() => {
    setTrailGeometry(null);
    patchUiState({
      mode: null,
      activePoiId: null,
      activeTrailId: null,
      editingPoiId: null,
      editingTrailId: null,
      trailDeletingId: null,
      selectedLocation: null,
    });
  }, [setTrailGeometry, patchUiState]);

  const handleStartAddPOI = useCallback(() => {
    patchUiState({
      activePoiId: null,
      activeTrailId: null,
      editingPoiId: null,
      editingTrailId: null,
      mode: "add-poi",
      trailDeletingId: null,
      selectedLocation: null,
      formData: {
        name: "",
        description: "",
        category_id: "",
        is_public: true,
        status: DEFAULT_TRAIL_STATUS,
      },
    });
    setTrailGeometry(null);
  }, [patchUiState, setTrailGeometry]);

  const handleStartAddTrail = useCallback(() => {
    patchUiState({
      activePoiId: null,
      activeTrailId: null,
      editingPoiId: null,
      editingTrailId: null,
      trailDeletingId: null,
      mode: "add-trail",
      formData: {
        name: "",
        description: "",
        status: DEFAULT_TRAIL_STATUS,
        is_public: true,
      },
    });
    setTrailGeometry(null);
  }, [patchUiState, setTrailGeometry]);

  // ── Form submission ──────────────────────────────────────────────────────────
  const handleCreateTrail = useCallback(async () => {
    if (!formData.name || !drawnTrail) {
      alert("Please fill in the trail name and draw the trail path on the map");
      return;
    }

    setSubmitting(true);
    const isUpdating = Boolean(editingTrailId);

    const payload = {
      name: formData.name.trim(),
      status: formData.status || DEFAULT_TRAIL_STATUS,
      description: formData.description?.trim() || null,
      is_public: formData.is_public,
      geojson: drawnTrail,
      ...(!isUpdating && { sort_index: 0 }),
    };

    try {
      const result = await upsertTrail({
        token,
        payload,
        trailId: editingTrailId,
        onUnauthorized: handleSessionExpired,
      });
      alert(`Trail "${result.trail?.name || formData.name}" ${isUpdating ? "updated" : "created"}
   successfully!`);
      await loadMapData();
      setActiveTrail(null);
      setEditingTrailId(null);
      handleCancelMode();
    } catch (error) {
      alert(`Failed to save trail: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    drawnTrail,
    token,
    editingTrailId,
    handleSessionExpired,
    loadMapData,
    setSubmitting,
    setActiveTrail,
    setEditingTrailId,
    handleCancelMode,
  ]);

  const handleCreatePOI = useCallback(async () => {
    if (!formData.category_id || !formData.name || !selectedLocation) {
      alert("Please fill in all required fields and select a location");
      return;
    }

    const categoryId = parseInt(formData.category_id, 10);
    if (Number.isNaN(categoryId)) {
      alert("Please choose a valid category");
      return;
    }

    setSubmitting(true);
    const isEditingExisting = Boolean(editingPoiId);

    const payload = {
      category_id: categoryId,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      gmaps_url: `https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`,
      is_public: formData.is_public,
      sort_index: 0,
    };

    try {
      const result = await upsertPoi({
        token,
        payload,
        poiId: editingPoiId,
        onUnauthorized: handleSessionExpired,
      });
      alert(
        `POI "${result.poi?.name || formData.name}" ${
          isEditingExisting ? "updated" : "created"
        } successfully!`,
      );
      await loadMapData();
      setActivePoi(null);
      setEditingPoiId(null);
      handleCancelMode();
    } catch (error) {
      alert(`Failed to save POI: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    selectedLocation,
    editingPoiId,
    token,
    handleSessionExpired,
    loadMapData,
    setSubmitting,
    setActivePoi,
    setEditingPoiId,
    handleCancelMode,
  ]);

  const handleFormSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (mode === "add-poi") await handleCreatePOI();
      else if (mode === "add-trail") await handleCreateTrail();
    },
    [mode, handleCreatePOI, handleCreateTrail],
  );

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEditingTrail = useCallback(
    (trail) => {
      if (!trail) return;

      setActiveTrailId(null);
      setActivePoiId(null);
      setMode("add-trail");
      focusTrailOnMap(trail);
      setEditingTrailId(trail.id);
      setTrailDeletingId(null);
      setSubmitting(false);
      setFormData((prev) => ({
        ...prev,
        name: trail.name || "",
        description: trail.description || "",
        status: trail.status || DEFAULT_TRAIL_STATUS,
        is_public: trail.isPublic !== false,
      }));

      const existingGeo =
        trail.geojson && Object.keys(trail.geojson).length
          ? trail.geojson
          : null;
      setTrailGeometry(existingGeo);
    },
    [
      setActiveTrailId,
      setActivePoiId,
      setMode,
      focusTrailOnMap,
      setEditingTrailId,
      setTrailDeletingId,
      setSubmitting,
      setFormData,
      setTrailGeometry,
    ],
  );

  const startEditingPoi = useCallback(
    (poi) => {
      if (!poi) return;

      const categoryId = categoryIdMap[poi.category] ?? null;
      if (!categoryId) {
        alert("Unable to determine this POI's category. Please refresh.");
        return;
      }

      const hasCoords = poi.lat != null && poi.lng != null;

      patchUiState({
        activePoiId: null,
        activeTrailId: null,
        mode: "add-poi",
        editingPoiId: poi.id,
        editingTrailId: null,
        trailDeletingId: null,
        selectedLocation: hasCoords
          ? { lat: Number(poi.lat), lng: Number(poi.lng) }
          : null,
        formData: {
          name: poi.name || "",
          description: poi.description || "",
          category_id: categoryId,
          is_public: poi.isPublic !== false,
          status: DEFAULT_TRAIL_STATUS,
        },
      });
      setTrailGeometry(null);
    },
    [categoryIdMap, patchUiState, setTrailGeometry],
  );

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const handleDeleteTrail = useCallback(
    async (trail) => {
      if (!trail) return;
      if (!window.confirm(`Are you sure you want to delete "${trail.name}"?`))
        return;

      setTrailDeletingId(trail.id);
      try {
        await removeTrail({
          token,
          trailId: trail.id,
          onUnauthorized: handleSessionExpired,
        });
        alert(`Trail "${trail.name}" deleted successfully.`);
        setActiveTrail(null);
        await loadMapData();
        handleCancelMode();
      } catch (error) {
        alert(`Failed to delete trail: ${error.message}`);
      } finally {
        setTrailDeletingId(null);
      }
    },
    [
      token,
      handleSessionExpired,
      setTrailDeletingId,
      setActiveTrail,
      loadMapData,
      handleCancelMode,
    ],
  );

  const handleDeletePoi = useCallback(
    async (poi) => {
      if (!poi) return;
      if (!window.confirm(`Are you sure you want to delete "${poi.name}"?`))
        return;

      setPoiDeletingId(poi.id);
      try {
        await removePoi({
          token,
          poiId: poi.id,
          onUnauthorized: handleSessionExpired,
        });
        alert(`POI "${poi.name}" deleted successfully.`);
        await loadMapData();
        setActivePoi(null);
        if (editingPoiId === poi.id) handleCancelMode();
      } catch (error) {
        alert(`Failed to delete POI: ${error.message}`);
      } finally {
        setPoiDeletingId(null);
      }
    },
    [
      token,
      handleSessionExpired,
      setPoiDeletingId,
      loadMapData,
      setActivePoi,
      editingPoiId,
      handleCancelMode,
    ],
  );

  const handleToggleCategory = useCallback(
    (categoryId) => {
      setCategoryFilters((prev) => ({
        ...prev,
        [categoryId]: !prev[categoryId],
      }));
    },
    [setCategoryFilters],
  );

  const handleToggleAll = useCallback(() => {
    setCategoryFilters((prev) => {
      const allOn = Object.values(prev).every((v) => v);
      return Object.fromEntries(Object.keys(prev).map((key) => [key, !allOn]));
    });
  }, [setCategoryFilters]);

  const instructionMessage = useMemo(() => {
    if (mode === "add-poi") {
      if (editingPoiId)
        return selectedLocation
          ? "Editing this point. Update the details or click the map to adjust its location."
          : "Editing this point. Click the map to confirm a location.";
      return selectedLocation
        ? "Location selected! Complete the form to save"
        : "Fill the form below, then click on the map to select location";
    }
    if (mode === "add-trail") {
      if (editingTrailId)
        return drawnTrail
          ? "Editing this track. Update the details or choose Redraw to adjust the path."
          : "Editing this track. Draw the updated path on the map.";
      return drawnTrail
        ? "Trail drawn! Fill in the details and save"
        : "Use the drawing tools to draw your trail on the map";
    }
    return "Filter POIs or add new items";
  }, [mode, selectedLocation, drawnTrail, editingPoiId, editingTrailId]);

  const sidebarModel = useMemo(
    () => ({
      ui: { instructionMessage, mode, showForm, submitting },
      actions: {
        onStartAddPOI: handleStartAddPOI,
        onStartAddTrail: handleStartAddTrail,
        onCancelMode: handleCancelMode,
        onSubmit: handleFormSubmit,
      },
      poiForm: {
        editingPoiId,
        selectedLocation,
        setSelectedLocation,
        categories,
        categoryIconPathMap,
        categoryColors,
        formData,
        setFormData,
      },
      trailForm: {
        editingTrailId,
        drawnTrail,
        setTrailGeometry,
        formData,
        setFormData,
        selectedTrailStyle,
      },
      filters: {
        categories,
        categoryFilters,
        categoryIconPathMap,
        categoryColors,
        allOn: Object.values(categoryFilters).every((v) => v),
        onToggleAll: handleToggleAll,
        onToggleCategory: handleToggleCategory,
      },
    }),
    [
      instructionMessage,
      mode,
      showForm,
      submitting,
      handleStartAddPOI,
      handleStartAddTrail,
      handleCancelMode,
      handleFormSubmit,
      editingPoiId,
      selectedLocation,
      setSelectedLocation,
      categories,
      categoryIconPathMap,
      formData,
      setFormData,
      editingTrailId,
      drawnTrail,
      setTrailGeometry,
      selectedTrailStyle,
      categoryFilters,
      handleToggleAll,
      handleToggleCategory,
    ],
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400;600"
      />

      <div
        className="relative rounded-3xl border border-gray-200 bg-gray-100 shadow-xl           
  overflow-hidden"
        style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
      >
        <div ref={mapRef} className="absolute inset-0 z-0" />

        <EditorSidebar sidebarModel={sidebarModel} />

        <TrailDetailsPanel
          activeTrail={activeTrail}
          activeTrailStyle={activeTrailStyle}
          activeTrailAccent={activeTrailAccent}
          trailDeletingId={trailDeletingId}
          onClose={() => setActiveTrail(null)}
          onCenter={() => focusTrailOnMap(activeTrail)}
          onEdit={() => startEditingTrail(activeTrail)}
          onDelete={() => handleDeleteTrail(activeTrail)}
        />

        <PoiDetailsPanel
          activePoi={activePoi}
          resolveCategoryLabel={resolveCategoryLabel}
          poiDeletingId={poiDeletingId}
          onClose={() => setActivePoi(null)}
          onEdit={() => startEditingPoi(activePoi)}
          onDelete={() => handleDeletePoi(activePoi)}
        />

        {loading && (
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center 
  justify-center"
            style={{ zIndex: 2000 }}
          >
            <div className="bg-white px-6 py-4 rounded-xl shadow-lg">
              <p className="text-sm text-gray-600">Loading map data...</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
