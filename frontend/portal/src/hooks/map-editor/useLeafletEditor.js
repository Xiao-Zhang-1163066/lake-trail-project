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
  setFormData,
  setShowForm,
  rebuildDrawnTrailFromLayers,
}) {
  const [isDrawReady, setIsDrawReady] = useState(false);

  // ── Initialize Leaflet map + draw event listeners (runs once) ────────────────
  useEffect(() => {
    let cancelled = false;

    const waitForDrawReady = async (L) => {
      let attempts = 0;
      while (!cancelled && (!L?.Draw || !L.Draw.Event)) {
        if (attempts >= 20) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts += 1;
      }
      return !cancelled;
    };

    let handleDrawCreated;
    let handleDrawStart;
    let handleDrawStop;
    let handleDrawVertex;
    let handleDrawEdited;
    let handleDrawDeleted;

    const initializeMap = async () => {
      try {
        const leafletModule = await import("leaflet");
        const L = leafletModule.default || leafletModule;

        leafletRef.current = L;

        // leaflet-draw requires L on window/globalThis
        if (typeof window !== "undefined") window.L = L;
        if (typeof globalThis !== "undefined") globalThis.L = L;

        await import("leaflet-draw");

        const drawReady = await waitForDrawReady(L);

        if (cancelled || mapInstanceRef.current || !mapRef.current) {
          if (!cancelled) setIsDrawReady(Boolean(drawReady && L?.Draw?.Event));
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

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnLayersRef.current = drawnItems;

        const legendControl = L.control({ position: "topright" });
        legendControl.onAdd = () => {
          const container = L.DomUtil.create("div", "map-legend");
          container.setAttribute("aria-label", "Trail legend");
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
          legendContainerRef.current = container;
          return container;
        };
        legendControl.addTo(map);
        legendControlRef.current = legendControl;

        // Prevent map clicks from propagating through Leaflet controls
        const mapContainer = mapRef.current;
        if (mapContainer) {
          mapContainer.addEventListener(
            "click",
            (e) => {
              const target = e.target;
              if (
                target.closest(".leaflet-control") ||
                target.closest(".leaflet-draw") ||
                target.closest(".leaflet-draw-toolbar")
              ) {
                e.stopPropagation();
              }
            },
            false
          );
        }

        mapInstanceRef.current = map;

        if (!cancelled) setIsDrawReady(Boolean(drawReady && L?.Draw?.Event));

        if (!drawReady || !L.Draw || !L.Draw.Event) {
          console.error("Leaflet.Draw did not initialize in time");
          return;
        }

        handleDrawCreated = (e) => {
          const layer = e.layer;
          currentDrawnLayerRef.current = layer;
          setActiveTrail(null);

          if (drawnLayersRef.current) {
            drawnLayersRef.current.addLayer(layer);
            layer.addTo(map);
          }

          rebuildDrawnTrailFromLayers();

          // Defensive check: leaflet-draw sometimes removes the layer immediately
          setTimeout(() => {
            if (
              drawnLayersRef.current &&
              drawnLayersRef.current.getLayers().length === 0 &&
              currentDrawnLayerRef.current
            ) {
              drawnLayersRef.current.addLayer(currentDrawnLayerRef.current);
              currentDrawnLayerRef.current.addTo(map);
            }
          }, 100);
        };

        handleDrawStart = () => {};
        handleDrawStop = () => {};
        handleDrawVertex = () => {};

        handleDrawEdited = () => {
          rebuildDrawnTrailFromLayers();
        };

        handleDrawDeleted = (e) => {
          if (drawnLayersRef.current && e.layers) {
            e.layers.eachLayer((layer) => {
              if (drawnLayersRef.current.hasLayer(layer)) {
                drawnLayersRef.current.removeLayer(layer);
              }
            });
          }
          rebuildDrawnTrailFromLayers();
        };

        map.on("draw:created", handleDrawCreated);
        map.on("draw:drawstart", handleDrawStart);
        map.on("draw:drawstop", handleDrawStop);
        map.on("draw:drawvertex", handleDrawVertex);
        map.on("draw:edited", handleDrawEdited);
        map.on("draw:deleted", handleDrawDeleted);
      } catch (error) {
        console.error("Failed to load map libraries:", error);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        if (handleDrawCreated) mapInstanceRef.current.off("draw:created", handleDrawCreated);
        if (handleDrawStart) mapInstanceRef.current.off("draw:drawstart", handleDrawStart);
        if (handleDrawStop) mapInstanceRef.current.off("draw:drawstop", handleDrawStop);
        if (handleDrawVertex) mapInstanceRef.current.off("draw:drawvertex", handleDrawVertex);
        if (handleDrawEdited) mapInstanceRef.current.off("draw:edited", handleDrawEdited);
        if (handleDrawDeleted) mapInstanceRef.current.off("draw:deleted", handleDrawDeleted);
        if (legendControlRef.current) {
          try {
            mapInstanceRef.current.removeControl(legendControlRef.current);
          } catch (e) {
            console.warn("Error removing legend control:", e);
          }
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      legendControlRef.current = null;
      legendContainerRef.current = null;
    };
  }, [
    currentDrawnLayerRef,
    drawnLayersRef,
    legendContainerRef,
    legendControlRef,
    leafletRef,
    mapInstanceRef,
    mapRef,
    rebuildDrawnTrailFromLayers,
    setActiveTrail,
  ]);

  // ── POI placement: capture map click when in add-poi mode ───────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      setActiveTrail(null);
      setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setFormData((prev) => ({ ...prev, type: "poi" }));
      setShowForm(true);
    };

    if (mode === "add-poi") {
      map.on("click", handleMapClick);
    } else {
      map.off("click", handleMapClick);
    }

    return () => {
      map.off("click", handleMapClick);
    };
  }, [leafletRef, mapInstanceRef, mode, setActiveTrail, setFormData, setSelectedLocation, setShowForm]);

  // ── Dismiss active POI on map click ─────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !activePoi) return;
    const map = mapInstanceRef.current;
    const handleDismiss = () => setActivePoi(null);
    map.on("click", handleDismiss);
    return () => {
      map.off("click", handleDismiss);
    };
  }, [activePoi, mapInstanceRef, setActivePoi]);

  // ── Draw toolbar: add/remove when entering trail mode ───────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    if (mode === "add-trail" && drawnLayersRef.current) {
      if (!isDrawReady) {
        console.warn("Leaflet.Draw has not finished loading yet");
        return;
      }
      if (!L.Control?.Draw || !L.Draw?.Polyline) {
        console.warn("Leaflet.Draw is not ready yet, delaying draw control setup");
        return;
      }

      const statusStyle = getStatusStyle(trailStatus);
      const shapeOptions = {
        color: statusStyle.color,
        weight: statusStyle.weight,
        ...(statusStyle.dashArray && { dashArray: statusStyle.dashArray }),
      };

      const drawControl = new L.Control.Draw({
        position: "topright",
        edit: { featureGroup: drawnLayersRef.current, remove: true },
        draw: {
          polyline: { shapeOptions, repeatMode: false },
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

    return () => {
      if (drawControlRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeControl(drawControlRef.current);
        } catch (e) {
          console.warn("Error removing draw control:", e);
        }
      }
    };
  }, [
    drawControlRef,
    drawnLayersRef,
    isDrawReady,
    leafletRef,
    mapInstanceRef,
    mode,
    trailStatus,
  ]);

  // ── Sync drawn layer style when trail status changes ─────────────────────────
  useEffect(() => {
    if (!drawnLayersRef.current) return;
    const statusStyle = getStatusStyle(trailStatus);
    const applyStyle = (layer) => {
      if (layer && typeof layer.setStyle === "function") {
        layer.setStyle({
          color: statusStyle.color,
          weight: statusStyle.weight,
          dashArray: statusStyle.dashArray || null,
        });
      }
    };
    drawnLayersRef.current.eachLayer(applyStyle);
    if (currentDrawnLayerRef.current) applyStyle(currentDrawnLayerRef.current);
  }, [currentDrawnLayerRef, drawnLayersRef, trailStatus]);
}
