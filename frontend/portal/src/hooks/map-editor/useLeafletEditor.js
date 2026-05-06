import { useEffect, useState } from "react";
import { getStatusStyle } from "../../constants/trailStatuses";

export function useLeafletEditor({
  mapRef,
  mapInstanceRef,
  leafletRef,
  drawControlRef,
  drawnLayersRef,
  currentDrawnLayerRef,
  legendControlRef,
  legendContainerRef,
  mode,
  trailStatus,
  activePoi,
  setActivePoi,
  setActiveTrail,
  setSelectedLocation,
  rebuildDrawnTrailFromLayers,
}) {
  const [isDrawReady, setIsDrawReady] = useState(false);

  // ── Effect 1: Initialise Leaflet map once on mount ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      // Dynamic import — Leaflet touches `window` on import, which breaks SSR.
      const leafletModule = await import("leaflet");
      // Handles both ES module (.default) and CommonJS (the module itself)
      const L = leafletModule.default || leafletModule;
      leafletRef.current = L;

      // leaflet-draw is an old plugin that looks for L on window — required hack
      window.L = L;
      await import("leaflet-draw");

      // Bail out if unmounted or map already exists
      if (cancelled || mapInstanceRef.current || !mapRef.current) {
        if (!cancelled) setIsDrawReady(Boolean(L?.Draw?.Event));
        return;
      }

      const map = L.map(mapRef.current, {
        center: [-43.75, 172.33],
        zoom: 11,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Add zoom control to bottom-right instead of default top-left
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // FeatureGroup holds all user-drawn shapes.
      // leaflet-draw needs a reference to it so it knows what's editable.
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnLayersRef.current = drawnItems;

      // Add legend as a custom Leaflet control in the top-right corner
      const legendControl = L.control({ position: "topright" });
      legendControl.onAdd = () => {
        const container = L.DomUtil.create("div", "map-legend");
        container.setAttribute("aria-label", "Trail legend");
        // Prevent map clicks from firing when clicking inside the legend
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        legendContainerRef.current = container;
        return container;
      };
      legendControl.addTo(map);
      legendControlRef.current = legendControl;

      mapInstanceRef.current = map;
      setIsDrawReady(Boolean(L?.Draw?.Event));

      // Wire up draw events
      map.on("draw:created", (e) => {
        const layer = e.layer;
        currentDrawnLayerRef.current = layer;
        setActiveTrail(null);
        drawnLayersRef.current.addLayer(layer);
        rebuildDrawnTrailFromLayers();
      });

      map.on("draw:edited", () => {
        rebuildDrawnTrailFromLayers();
      });

      map.on("draw:deleted", (e) => {
        // e.layers exists on leaflet-draw events but is not in Leaflet's base type
        const deletedLayers = /** @type {any} */ (e).layers;
        if (deletedLayers) deletedLayers.eachLayer((layer) => drawnLayersRef.current.removeLayer(layer));
        rebuildDrawnTrailFromLayers();
      });
    };

    initializeMap();

    // Cleanup: destroy the map when the component unmounts
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        if (legendControlRef.current) {
          try { mapInstanceRef.current.removeControl(legendControlRef.current); }
          catch (e) { console.warn("Error removing legend control:", e); }
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      legendControlRef.current = null;
      legendContainerRef.current = null;
    };
    // Refs are intentionally excluded — they are stable objects whose identity
    // never changes. Callbacks (setActiveTrail, rebuildDrawnTrailFromLayers) are
    // wrapped in useCallback in the parent and are also stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once on mount only

  // ── Effect 2: Add/remove draw toolbar based on mode ─────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // Always remove the existing control first
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    // Only add it back if we're in trail-drawing mode
    if (mode === "add-trail" && drawnLayersRef.current && isDrawReady) {
      const statusStyle = getStatusStyle(trailStatus);

      const drawControl = new L.Control.Draw({
        position: "topright",
        edit: { featureGroup: drawnLayersRef.current, remove: true },
        draw: {
          polyline: {
            shapeOptions: {
              color: statusStyle.color,
              weight: statusStyle.weight,
              dashArray: statusStyle.dashArray || null,
            },
          },
          // Trails are lines — disable all other shape types
          polygon: false,
          circle: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
      });

      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    }

    // Cleanup: remove the control when mode changes or component unmounts
    return () => {
      if (drawControlRef.current && mapInstanceRef.current) {
        try { mapInstanceRef.current.removeControl(drawControlRef.current); }
        catch (e) { console.warn("Error removing draw control:", e); }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, trailStatus, isDrawReady]); // refs (drawControlRef, drawnLayersRef, etc.) are stable — intentionally omitted

  // ── Effect 3: Capture map clicks for POI placement ──────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      setActiveTrail(null);
      setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    };

    if (mode === "add-poi") {
      map.on("click", handleMapClick);
    }

    // Cleanup: always remove — prevents listeners stacking up on mode changes
    return () => { map.off("click", handleMapClick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]); // mapInstanceRef is a stable ref — intentionally omitted

  // ── Effect 4: Dismiss active POI on map click ────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !activePoi) return;
    const map = mapInstanceRef.current;

    const handleDismiss = () => setActivePoi(null);
    map.on("click", handleDismiss);

    return () => { map.off("click", handleDismiss); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePoi]); // mapInstanceRef and setActivePoi are stable — intentionally omitted

  // ── Effect 5: Sync drawn layer style when trail status changes ───────────────
  useEffect(() => {
    if (!drawnLayersRef.current) return;
    const statusStyle = getStatusStyle(trailStatus);
    drawnLayersRef.current.eachLayer((layer) => {
      if (typeof layer.setStyle === "function") {
        layer.setStyle({
          color: statusStyle.color,
          weight: statusStyle.weight,
          dashArray: statusStyle.dashArray || null,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailStatus]); // drawnLayersRef is a stable ref — intentionally omitted
}
