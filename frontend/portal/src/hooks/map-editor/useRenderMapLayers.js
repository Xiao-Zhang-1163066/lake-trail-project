import { useEffect } from "react";
import { getAssetUrl } from "../../utils/mapEditor/assetUrl";
import { hasCoordinates } from "../../utils/mapEditor/geojson";
import { buildTrailLegendItems } from "../../utils/mapEditor/trailLegend";
import { createMarkerIcon } from "../../utils/mapEditor/markerIcon";
import { categoryColors } from "../../constants/poiCategories";
import { getStatusStyle } from "../../constants/trailStatuses";

export function useRenderMapLayers({
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
  setShowForm,
  setSelectedLocation,
  setEditingTrailId,
  setTrailGeometry,
  setTrailDeletingId,
}) {
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;

      // Remove existing POI/trail layers, preserve tile layer and draw feature group
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) return;
        if (layer === drawnLayersRef.current) return;
        if (drawnLayersRef.current?.hasLayer(layer)) return;
        if (
          layer instanceof L.Marker ||
          layer instanceof L.Polyline ||
          layer instanceof L.GeoJSON
        ) {
          map.removeLayer(layer);
        }
      });

      // Render trail polylines
      trails.forEach((trail) => {
        if (!hasCoordinates(trail.geojson)) return;

        const trailStyle = getStatusStyle(trail.status);
        const baseWeight = trailStyle.weight || 3;
        const isActive = activeTrail?.id === trail.id;

        const geoLayer = L.geoJSON(trail.geojson, {
          style: {
            color: trailStyle.color || "#3B82F6",
            weight: isActive ? baseWeight + 2 : baseWeight,
            dashArray: trailStyle.dashArray || null,
            opacity: trail.isPublic ? 1 : 0.45,
          },
        });

        geoLayer.on("click", (event) => {
          L.DomEvent.stop(event);
          const bounds = geoLayer.getBounds?.();
          if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.05));
          setActivePoi(null);
          setEditingPoiId(null);
          setActiveTrail(trail);
          setMode(null);
          setShowForm(false);
          setSelectedLocation(null);
          setEditingTrailId(null);
          setTrailGeometry(null);
          setTrailDeletingId(null);
        });

        geoLayer.on("mouseover", () => { map.getContainer().style.cursor = "pointer"; });
        geoLayer.on("mouseout", () => { map.getContainer().style.cursor = ""; });

        geoLayer.addTo(map);

        if (isActive) {
          geoLayer.eachLayer((child) => child.bringToFront?.());
        }
      });

      // Render trail legend
      const legendContainer = legendContainerRef.current;
      if (legendContainer) {
        const legendSource =
          Array.isArray(trailLegendItems) && trailLegendItems.length
            ? trailLegendItems
            : buildTrailLegendItems(trails);

        legendContainer.innerHTML = "";

        if (legendSource.length) {
          legendContainer.style.display = "block";

          const titleEl = document.createElement("div");
          titleEl.className = "map-legend__title";
          titleEl.textContent = "Trail categories";
          legendContainer.appendChild(titleEl);

          legendSource.forEach((item) => {
            const row = document.createElement("div");
            row.className = "map-legend__item";
            if (item.dashArray) row.setAttribute("data-dashed", "true");

            const swatch = document.createElement("span");
            swatch.className = "map-legend__swatch";
            swatch.style.setProperty("--line-color", item.color || "#3B82F6");
            row.appendChild(swatch);

            const label = document.createElement("span");
            label.className = "map-legend__label";
            label.textContent = item.label || item.id || "Trail";
            row.appendChild(label);

            legendContainer.appendChild(row);
          });
        } else {
          legendContainer.style.display = "none";
        }
      }

      // Render POI markers
      const defaultIconUrl = getAssetUrl("/assets/icons/categories/default.svg");

      pois.forEach((poi) => {
        if (!categoryFilters[poi.category]) return;
        if (!poi.lat || !poi.lng) return;

        const accent = categoryColors[poi.category] || "#1fa74d";
        const iconPath = categoryIconPathMap[poi.category] || defaultIconUrl;

        const marker = L.marker([poi.lat, poi.lng], {
          icon: createMarkerIcon(L, iconPath, accent, defaultIconUrl),
          title: poi.name,
          riseOnHover: true,
        }).addTo(map);

        marker.on("click", () => {
          map.panTo([poi.lat, poi.lng], { animate: true });
          setActivePoi(poi);
          setActiveTrail(null);
          setShowForm(false);
          setEditingPoiId(null);
          setEditingTrailId(null);
          setTrailDeletingId(null);
          setMode(null);
          setSelectedLocation(null);
          setTrailGeometry(null);
        });
      });

      // Temporary marker for new POI placement
      if (selectedLocation && mode === "add-poi") {
        const tempIcon = L.icon({
          iconUrl: getAssetUrl("/assets/icons/temp-poi-marker.svg"),
          iconSize: [36, 50],
          iconAnchor: [18, 46],
          popupAnchor: [0, -46],
        });
        L.marker([selectedLocation.lat, selectedLocation.lng], {
          icon: tempIcon,
          riseOnHover: true,
        })
          .addTo(map)
          .bindPopup("📍 New POI location");
      }
    });
  }, [
    pois,
    trails,
    categoryFilters,
    selectedLocation,
    categoryIconPathMap,
    trailLegendItems,
    activeTrail,
    mode,
    mapInstanceRef,
    drawnLayersRef,
    legendContainerRef,
    setActivePoi,
    setEditingPoiId,
    setActiveTrail,
    setMode,
    setShowForm,
    setSelectedLocation,
    setEditingTrailId,
    setTrailGeometry,
    setTrailDeletingId,
  ]);
}
