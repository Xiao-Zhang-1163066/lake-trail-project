import React, { useState, useEffect, useRef, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useAuth } from "../contexts/AuthContext";
import { getAssetUrl } from "../utils/mapEditor/assetUrl";
import {
  cloneGeoJSON,
  hasCoordinates,
  mergeGeoJsonItems,
} from "../utils/mapEditor/geojson";
import { buildTrailLegendItems } from "../utils/mapEditor/trailLegend";
import { createMarkerIcon } from "../utils/mapEditor/markerIcon";
import {
  fetchPublicMapData,
  removePoi,
  removeTrail,
  upsertPoi,
  upsertTrail,
} from "../services/mapAdminApi";
import {
  DEFAULT_TRAIL_STATUS,
  TRAIL_STATUS_OPTIONS,
  getStatusStyle,
} from "../constants/trailStatuses";

// Category colors
const categoryColors = {
  cycling: "#0ea5e9",
  camping: "#047857",
  kayaking: "#2563eb",
  bird: "#0f766e",
  fishing: "#7c3aed",
  trailhead: "#ea580c",
  parking: "#475569",
  restroom: "#14b8a6", // Public Amenities
};


export default function InteractiveMapEditor() {
  const { token, handleSessionExpired } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null); // Store Leaflet module reference
  const [pois, setPois] = useState([]);
  const [trails, setTrails] = useState([]);
  const [trailLegendItems, setTrailLegendItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState({});
  const [categoryIconPathMap, setCategoryIconPathMap] = useState({}); // Map: ID/slug -> SVG path
  const [categoryIdMap, setCategoryIdMap] = useState({}); // Map: slug -> numeric ID
  const [mode, setMode] = useState(null); // null, 'add-poi', 'add-trail'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawnTrail, setDrawnTrail] = useState(null); // Store drawn trail GeoJSON
  const [isDrawReady, setIsDrawReady] = useState(false); // Track Leaflet.Draw readiness
  const drawControlRef = useRef(null); // Reference to Leaflet.Draw control
  const drawnLayersRef = useRef(null); // Reference to FeatureGroup for drawn items
  const currentDrawnLayerRef = useRef(null); // Reference to the current drawn layer
  const legendControlRef = useRef(null);
  const legendContainerRef = useRef(null);
  const [formData, setFormData] = useState({
    type: "poi", // 'poi' or 'trail'
    name: "",
    description: "",
    category_id: "",
    is_public: true,
    status: DEFAULT_TRAIL_STATUS,
    legend_label: "",
  });
  const [activePoi, setActivePoi] = useState(null); // POI currently highlighted on the map
  const [editingPoiId, setEditingPoiId] = useState(null);
  const [poiDeletingId, setPoiDeletingId] = useState(null);
  const [activeTrail, setActiveTrail] = useState(null);
  const [editingTrailId, setEditingTrailId] = useState(null);
  const [trailDeletingId, setTrailDeletingId] = useState(null);
  const selectedTrailStyle = getStatusStyle(formData.status);
  const activeTrailStyle = activeTrail
    ? getStatusStyle(activeTrail.status)
    : null;
  const activeTrailAccent = activeTrailStyle?.color || "#2563eb";
  const categoryLabelMap = useMemo(() => {
    const labelMap = {};
    categories.forEach((cat) => {
      const slug = cat.slug || cat.icon || String(cat.id);
      labelMap[slug] = cat.label;
      labelMap[String(cat.id)] = cat.label;
    });
    return labelMap;
  }, [categories]);
  const resolveCategoryLabel = (value) =>
    categoryLabelMap[value] || categoryLabelMap[String(value)] || value || "—";

  const setTrailGeometry = (geojson) => {
    const normalized = cloneGeoJSON(geojson);
    if (drawnLayersRef.current) {
      drawnLayersRef.current.clearLayers();
    }
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
      if (bounds && bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds.pad(0.08));
      }
    } catch (error) {
      console.warn("Unable to fit map to trail geometry", error);
    }
  };

  const focusTrailOnMap = (trail) => {
    if (
      !trail ||
      !trail.geojson ||
      !leafletRef.current ||
      !mapInstanceRef.current
    ) {
      return;
    }
    try {
      const L = leafletRef.current;
      const layer = L.geoJSON(trail.geojson);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds.pad(0.08));
      }
    } catch (error) {
      console.warn("Unable to focus trail on map", error);
    }
  };

  const rebuildDrawnTrailFromLayers = () => {
    if (!drawnLayersRef.current) {
      setDrawnTrail(null);
      return null;
    }

    const layers = drawnLayersRef.current.getLayers?.() || [];
    const geojsonItems = layers
      .map((layer) => {
        try {
          return layer.toGeoJSON?.();
        } catch (error) {
          console.warn("Failed to convert layer to GeoJSON", error);
          return null;
        }
      })
      .filter(Boolean);

    const merged = mergeGeoJsonItems(geojsonItems);
    setDrawnTrail(merged || null);
    return merged;
  };

  // Load Leaflet dynamically (only once)
  useEffect(() => {
    let cancelled = false;

    loadMapData();

    const waitForDrawReady = async (L) => {
      let attempts = 0;
      const maxAttempts = 20;

      while (!cancelled && (!L?.Draw || !L.Draw.Event)) {
        if (attempts >= maxAttempts) {
          return false;
        }

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

        if (typeof window !== "undefined") {
          window.L = L;
        }
        if (typeof globalThis !== "undefined") {
          globalThis.L = L;
        }

        await import("leaflet-draw");

        const drawReady = await waitForDrawReady(L);

        if (cancelled || mapInstanceRef.current || !mapRef.current) {
          if (!cancelled) {
            setIsDrawReady(Boolean(drawReady && L?.Draw?.Event));
          }
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

        const mapContainer = mapRef.current;
        if (mapContainer) {
          mapContainer.addEventListener(
            "click",
            (e) => {
              const target = e.target;
              const isLeafletControl =
                target.closest(".leaflet-control") ||
                target.closest(".leaflet-draw") ||
                target.closest(".leaflet-draw-toolbar");

              if (isLeafletControl) {
                e.stopPropagation();
              }
            },
            false
          );
        }

        mapInstanceRef.current = map;

        if (!cancelled) {
          setIsDrawReady(Boolean(drawReady && L?.Draw?.Event));
        }

        if (!drawReady || !L.Draw || !L.Draw.Event) {
          console.error("❌ Leaflet.Draw did not initialize in time");
          return;
        }

        console.log("📡 Setting up draw event listeners");
        console.log("✅ L.Draw.Event available:", L.Draw.Event);

        handleDrawCreated = (e) => {
          console.log("✅✅✅ Draw created event triggered! ✅✅✅");
          const layer = e.layer;

          currentDrawnLayerRef.current = layer;
          setActiveTrail(null);

          if (drawnLayersRef.current) {
            drawnLayersRef.current.addLayer(layer);
            console.log(
              "✅ Layer added to drawnLayersRef, total layers:",
              drawnLayersRef.current.getLayers().length
            );

            layer.addTo(map);
          } else {
            console.warn("⚠️ drawnLayersRef.current is null!");
          }

          rebuildDrawnTrailFromLayers();

          setTimeout(() => {
            if (drawnLayersRef.current) {
              const layerCount = drawnLayersRef.current.getLayers().length;
              console.log("🔍 Layer count after 100ms:", layerCount);
              if (layerCount === 0 && currentDrawnLayerRef.current) {
                console.error("❌ Layer was removed! Re-adding...");
                drawnLayersRef.current.addLayer(currentDrawnLayerRef.current);
                currentDrawnLayerRef.current.addTo(map);
              }
            }
          }, 100);
        };

        handleDrawStart = (e) => {
          console.log("🖊️ Drawing started", e);
        };

        handleDrawStop = (e) => {
          console.log("🛑 Drawing stopped", e);
        };

        handleDrawVertex = (e) => {
          console.log("📍 Vertex added", e);
        };

        handleDrawEdited = (e) => {
          console.log("✏️ Layers edited", e);
          rebuildDrawnTrailFromLayers();
        };

        handleDrawDeleted = (e) => {
          console.log("🗑️ Layers deleted", e);
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

        console.log("✅ Draw event listeners attached to map");
      } catch (error) {
        console.error("Failed to load map libraries:", error);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        if (handleDrawCreated) {
          mapInstanceRef.current.off("draw:created", handleDrawCreated);
        }
        if (handleDrawStart) {
          mapInstanceRef.current.off("draw:drawstart", handleDrawStart);
        }
        if (handleDrawStop) {
          mapInstanceRef.current.off("draw:drawstop", handleDrawStop);
        }
        if (handleDrawVertex) {
          mapInstanceRef.current.off("draw:drawvertex", handleDrawVertex);
        }
        if (handleDrawEdited) {
          mapInstanceRef.current.off("draw:edited", handleDrawEdited);
        }
        if (handleDrawDeleted) {
          mapInstanceRef.current.off("draw:deleted", handleDrawDeleted);
        }
        if (legendControlRef.current) {
          try {
            mapInstanceRef.current.removeControl(legendControlRef.current);
          } catch (error) {
            console.warn("⚠️ Error removing legend control:", error);
          }
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      legendControlRef.current = null;
      legendContainerRef.current = null;
    };
  }, []); // Empty dependency array - only run once

  // Handle map click for POI placement
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      setActiveTrail(null);
      setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      setFormData((prev) => ({
        ...prev,
        type: "poi",
      }));
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
  }, [mode]);

  useEffect(() => {
    if (!mapInstanceRef.current || !activePoi) return;
    const map = mapInstanceRef.current;
    const handleDismiss = () => setActivePoi(null);
    map.on("click", handleDismiss);
    return () => {
      map.off("click", handleDismiss);
    };
  }, [activePoi]);

  // Manage draw control based on mode
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    console.log("🎨 Draw control effect triggered, mode:", mode);

    // Remove existing draw control
    if (drawControlRef.current) {
      console.log("🗑️ Removing existing draw control");
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    // Add draw control when in add-trail mode
    if (mode === "add-trail" && drawnLayersRef.current) {
      if (!isDrawReady) {
        console.warn("⚠️ Leaflet.Draw has not finished loading yet");
        return;
      }
      if (!L.Control?.Draw || !L.Draw?.Polyline) {
        console.warn(
          "⚠️ Leaflet.Draw is not ready yet, delaying draw control setup"
        );
        return;
      }
      console.log("➕ Adding draw control for trail mode");
      const statusStyle = getStatusStyle(formData.status);
      const lineColor = statusStyle.color;
      const lineWeight = statusStyle.weight;

      console.log(
        "🎨 Draw settings - color:",
        lineColor,
        "weight:",
        lineWeight
      );

      const shapeOptions = {
        color: lineColor,
        weight: lineWeight,
      };

      if (statusStyle.dashArray) {
        shapeOptions.dashArray = statusStyle.dashArray;
      }

      const drawControl = new L.Control.Draw({
        position: "topright",
        edit: {
          featureGroup: drawnLayersRef.current,
          remove: true,
        },
        draw: {
          polyline: {
            shapeOptions,
            repeatMode: false, // Disable repeat mode
          },
          polygon: false,
          circle: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
      });

      map.addControl(drawControl);
      drawControlRef.current = drawControl;
      console.log("✅ Draw control added successfully");

      // Log the DOM to verify control is visible
      setTimeout(() => {
        const controls = document.querySelectorAll(".leaflet-draw");
        console.log("🔍 Found draw controls:", controls.length);
        if (controls.length > 0) {
          console.log("✅ Draw toolbar should be visible in top-right corner");

          // Check if the draw button is clickable
          const drawButton = document.querySelector(
            ".leaflet-draw-draw-polyline"
          );
          if (drawButton) {
            console.log("✅ Found polyline draw button");

            // Add a direct click listener for debugging
            drawButton.addEventListener(
              "click",
              (e) => {
                console.log("🖱️ Draw button clicked!", e);
                // The button works, no need to manually start
              },
              true
            );
          } else {
            console.warn("⚠️ Polyline draw button not found");
          }
        } else {
          console.warn("⚠️ Draw controls not found in DOM!");
        }
      }, 100);
    }

    return () => {
      // Clean up on unmount
      if (drawControlRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeControl(drawControlRef.current);
        } catch (e) {
          console.warn("⚠️ Error removing draw control:", e);
        }
      }
    };
  }, [mode, isDrawReady, formData.status]); // Recreate control when status changes

  useEffect(() => {
    if (!drawnLayersRef.current) {
      return;
    }
    const statusStyle = getStatusStyle(formData.status);
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
    if (currentDrawnLayerRef.current) {
      applyStyle(currentDrawnLayerRef.current);
    }
  }, [formData.status]);

  const loadMapData = async () => {
    try {
      setLoading(true);
      const { poisData, trailsData } = await fetchPublicMapData();

      setPois(poisData.pois || []);
      const segments = trailsData.segments || [];
      setTrails(segments);
      const legendItems = buildTrailLegendItems(segments);
      if (legendItems.length) {
        setTrailLegendItems(legendItems);
      } else if (Array.isArray(trailsData.legend)) {
        setTrailLegendItems(
          trailsData.legend.map((item) => ({
            id: item.id || item.label,
            label: item.label,
            color: item.color,
            dashArray: item.dashArray ?? item.dasharray ?? null,
          }))
        );
      } else {
        setTrailLegendItems([]);
      }
      setCategories(poisData.categories || []);

      // Initialize filters and icon maps
      const filters = {};
      const iconPathMapById = {}; // ID -> SVG path
      const iconPathMapBySlug = {}; // slug -> SVG path
      const idMap = {}; // slug -> ID

      (poisData.categories || []).forEach((cat) => {
        const slug = cat.slug || cat.icon || String(cat.id);
        const iconPath = cat.iconPath
          ? getAssetUrl(cat.iconPath)
          : getAssetUrl("/assets/icons/categories/default.svg");

        // Filter by slug (for POI data compatibility)
        filters[slug] = cat.defaultVisible !== false;

        // Icon maps for both ID and slug
        iconPathMapById[cat.id] = iconPath;
        iconPathMapBySlug[slug] = iconPath;

        // Slug to ID mapping
        idMap[slug] = cat.id;
      });

      setCategoryFilters(filters);
      setCategoryIconPathMap({ ...iconPathMapById, ...iconPathMapBySlug });
      setCategoryIdMap(idMap);
    } catch (error) {
      console.error("Failed to load map data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activePoi) return;
    const next = pois.find((poi) => poi.id === activePoi.id);
    if (!next) {
      setActivePoi(null);
      return;
    }
    if (next !== activePoi) {
      setActivePoi(next);
    }
  }, [pois, activePoi]);

  useEffect(() => {
    if (!activeTrail) return;
    const next = trails.find((trail) => trail.id === activeTrail.id);
    if (!next) {
      setActiveTrail(null);
      return;
    }
    if (next !== activeTrail) {
      setActiveTrail(next);
    }
  }, [trails, activeTrail]);

  // Render POIs and Trails on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    console.log("🗺️ Re-rendering map layers...");
    if (drawnLayersRef.current) {
      console.log(
        "📍 Drawn layers count before cleanup:",
        drawnLayersRef.current.getLayers().length
      );
    }

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;

      let removedCount = 0;

      // Clear existing layers except tile layer, drawn items FeatureGroup, and its children
      map.eachLayer((layer) => {
        // Skip the tile layer
        if (layer instanceof L.TileLayer) return;

        // Skip the drawn items FeatureGroup itself
        if (layer === drawnLayersRef.current) {
          console.log("⏭️ Skipping drawnLayersRef FeatureGroup");
          return;
        }

        // Skip layers that are children of the drawn items FeatureGroup
        const isDrawnLayer =
          drawnLayersRef.current && drawnLayersRef.current.hasLayer(layer);

        if (isDrawnLayer) {
          console.log("⏭️ Skipping drawn layer (child of FeatureGroup)");
          return;
        }

        // Remove other markers and polylines (existing POIs and trails)
        if (
          layer instanceof L.Marker ||
          layer instanceof L.Polyline ||
          layer instanceof L.GeoJSON
        ) {
          map.removeLayer(layer);
          removedCount++;
        }
      });

      console.log(`🧹 Removed ${removedCount} existing layers`);
      if (drawnLayersRef.current) {
        console.log(
          "📍 Drawn layers count after cleanup:",
          drawnLayersRef.current.getLayers().length
        );
      }

      // Render trails
      trails.forEach((trail) => {
        const trailGeojson = trail.geojson;
        if (!hasCoordinates(trailGeojson)) {
          return;
        }

        const baseWeight = trail.style?.weight || 3;
        const isActive = activeTrail?.id === trail.id;

        const style = {
          color: trail.style?.color || "#3B82F6",
          weight: isActive ? baseWeight + 2 : baseWeight,
          dashArray: trail.style?.dashArray || null,
          opacity: trail.isPublic ? 1 : 0.45,
        };

        const geoLayer = L.geoJSON(trailGeojson, { style });

        geoLayer.on("click", (event) => {
          L.DomEvent.stop(event);
          const bounds = geoLayer.getBounds?.();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.05));
          } else if (geoLayer.getBounds) {
            const fallbackBounds = geoLayer.getBounds();
            if (fallbackBounds && fallbackBounds.isValid()) {
              map.fitBounds(fallbackBounds.pad(0.05));
            }
          }
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

        geoLayer.on("mouseover", () => {
          map.getContainer().style.cursor = "pointer";
        });
        geoLayer.on("mouseout", () => {
          map.getContainer().style.cursor = "";
        });

        geoLayer.addTo(map);

        if (isActive) {
          geoLayer.eachLayer((child) => {
            if (child.bringToFront) {
              child.bringToFront();
            }
          });
        }
      });

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

            if (item.dashArray) {
              row.setAttribute("data-dashed", "true");
            }

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

      // Render POIs
      pois.forEach((poi) => {
        if (!categoryFilters[poi.category]) return; // Skip if filtered out
        if (!poi.lat || !poi.lng) return;

        const accent = categoryColors[poi.category] || "#1fa74d";
        // Get SVG icon path by category slug
        const iconPath =
          categoryIconPathMap[poi.category] ||
          getAssetUrl("/assets/icons/categories/default.svg");

        const marker = L.marker([poi.lat, poi.lng], {
          icon: createMarkerIcon(
            L,
            iconPath,
            accent,
            getAssetUrl("/assets/icons/categories/default.svg")
          ),
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

      // Show selected location
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
  ]); // Removed 'mode' to avoid interrupting draw operations

  const handleToggleCategory = (categoryId) => {
    setCategoryFilters((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleToggleAll = () => {
    const allOn = Object.values(categoryFilters).every((v) => v);
    const newState = {};
    Object.keys(categoryFilters).forEach((key) => {
      newState[key] = !allOn;
    });
    setCategoryFilters(newState);
  };

  const handleStartAddPOI = () => {
    setActivePoi(null);
    setActiveTrail(null);
    setEditingPoiId(null);
    setEditingTrailId(null);
    setMode("add-poi");
    setSelectedLocation(null);
    setShowForm(true);
    setTrailGeometry(null);
    setTrailDeletingId(null);
    setFormData({
      type: "poi",
      name: "",
      description: "",
      category_id: "",
      is_public: true,
      status: DEFAULT_TRAIL_STATUS,
      legend_label: "",
    });
  };

  const handleStartAddTrail = () => {
    setActivePoi(null);
    setActiveTrail(null);
    setEditingPoiId(null);
    setEditingTrailId(null);
    setTrailDeletingId(null);
    setMode("add-trail");
    setTrailGeometry(null);

    setFormData({
      type: "trail",
      name: "",
      description: "",
      status: DEFAULT_TRAIL_STATUS,
      legend_label: "",
      is_public: true,
    });
    setShowForm(true);
  };

  const handleCancelMode = () => {
    setMode(null);
    setSelectedLocation(null);
    setShowForm(false);
    setActivePoi(null);
    setActiveTrail(null);
    setEditingPoiId(null);
    setEditingTrailId(null);
    setTrailDeletingId(null);
    setTrailGeometry(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert("You must be logged in to create items");
      return;
    }

    if (mode === "add-poi") {
      await handleCreatePOI();
    } else if (mode === "add-trail") {
      await handleCreateTrail();
    }
  };

  const handleCreateTrail = async () => {
    if (!formData.name || !drawnTrail) {
      alert("Please fill in the trail name and draw the trail path on the map");
      return;
    }

    if (!token) {
      alert("You must be logged in to manage trails.");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      status: formData.status || DEFAULT_TRAIL_STATUS,
      description: formData.description?.trim() || null,
      legend_label: formData.legend_label?.trim() || null,
      is_public: formData.is_public,
      geojson: drawnTrail,
    };

    const isUpdating = Boolean(editingTrailId);

    if (!isUpdating) {
      payload.sort_index = 0;
    }

    try {
      const result = await upsertTrail({
        token,
        payload,
        trailId: editingTrailId,
        onUnauthorized: handleSessionExpired,
      });
      const name = result.trail?.name || formData.name;
      const verb = isUpdating ? "updated" : "created";

      alert(`Trail "${name}" ${verb} successfully!`);

      await loadMapData();
      setActiveTrail(null);
      setEditingTrailId(null);
      handleCancelMode();
    } catch (error) {
      console.error("Failed to save trail:", error);
      alert(`Failed to save trail: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePOI = async () => {
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

    // Generate Google Maps navigation link
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`;

    const payload = {
      category_id: categoryId,
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      gmaps_url: gmapsUrl,
      is_public: formData.is_public,
      sort_index: 0,
    };

    const isEditingExisting = Boolean(editingPoiId);

    try {
      const result = await upsertPoi({
        token,
        payload,
        poiId: editingPoiId,
        onUnauthorized: handleSessionExpired,
      });
      const verb = isEditingExisting ? "updated" : "created";
      const name = result.poi?.name || formData.name;
      alert(`POI "${name}" ${verb} successfully!`);

      await loadMapData();
      setActivePoi(null);
      setEditingPoiId(null);
      handleCancelMode();
    } catch (error) {
      console.error("Failed to save POI:", error);
      alert(`Failed to save POI: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingTrail = (trail) => {
    if (!trail) return;
    if (!token) {
      alert("You must be logged in to edit trails.");
      return;
    }

    setActiveTrail(null);
    setActivePoi(null);
    setMode("add-trail");
    setShowForm(true);
    focusTrailOnMap(trail);
    setEditingTrailId(trail.id);
    setTrailDeletingId(null);
    setSubmitting(false);

    setFormData((prev) => ({
      ...prev,
      type: "trail",
      name: trail.name || "",
      description: trail.description || "",
      status: trail.status || DEFAULT_TRAIL_STATUS,
      legend_label: trail.legendLabel || "",
      is_public: trail.isPublic !== false,
    }));

    const existingGeo =
      trail.geojson && Object.keys(trail.geojson || {}).length
        ? trail.geojson
        : null;
    setTrailGeometry(existingGeo);

    document.getElementById("map-instruction")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const handleDeleteTrail = async (trail) => {
    if (!trail) return;
    if (!token) {
      alert("You must be logged in to delete trails.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${trail.name}"?`
    );
    if (!confirmed) {
      return;
    }

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
      console.error("Failed to delete trail:", error);
      alert(`Failed to delete trail: ${error.message}`);
    } finally {
      setTrailDeletingId(null);
    }
  };

  const startEditingPoi = (poi) => {
    if (!poi) return;
    if (!token) {
      alert("You must be logged in to edit POIs.");
      return;
    }

    const categoryId =
      categoryIdMap[poi.category] ??
      categoryIdMap[String(poi.category)] ??
      null;

    if (!categoryId) {
      alert("Unable to determine this POI's category. Please refresh.");
      return;
    }

    setActivePoi(null);
    setActiveTrail(null);
    setMode("add-poi");
    setShowForm(true);
    setEditingPoiId(poi.id);
    setEditingTrailId(null);
    setTrailDeletingId(null);
    setTrailGeometry(null);
    const hasCoords =
      poi.lat !== null &&
      poi.lat !== undefined &&
      poi.lat !== "" &&
      poi.lng !== null &&
      poi.lng !== undefined &&
      poi.lng !== "";
    setSelectedLocation(
      hasCoords ? { lat: Number(poi.lat), lng: Number(poi.lng) } : null
    );
    setFormData((prev) => ({
      ...prev,
      type: "poi",
      name: poi.name || "",
      description: poi.description || "",
      category_id: categoryId,
      is_public: poi.isPublic !== false,
    }));
    document.getElementById("map-instruction")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const handleDeletePoi = async (poi) => {
    if (!poi) return;
    if (!token) {
      alert("You must be logged in to delete POIs.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${poi.name}"?`
    );
    if (!confirmed) return;

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
      if (editingPoiId === poi.id) {
        handleCancelMode();
      }
    } catch (error) {
      console.error("Failed to delete POI:", error);
      alert(`Failed to delete POI: ${error.message}`);
    } finally {
      setPoiDeletingId(null);
    }
  };

  const instructionMessage = useMemo(() => {
    if (mode === "add-poi") {
      if (editingPoiId) {
        return selectedLocation
          ? "Editing this point. Update the details or click the map to adjust its location."
          : "Editing this point. Click the map to confirm a location.";
      }
      if (!selectedLocation) {
        return "Fill the form below, then click on the map to select location";
      }
      return "Location selected! Complete the form to save";
    }
    if (mode === "add-trail") {
      if (editingTrailId) {
        return drawnTrail
          ? "Editing this track. Update the details or choose Redraw to adjust the path."
          : "Editing this track. Draw the updated path on the map.";
      }
      if (!drawnTrail) {
        return "Use the drawing tools to draw your trail on the map";
      }
      return "Trail drawn! Fill in the details and save";
    }
    return "Filter POIs or add new items";
  }, [mode, selectedLocation, drawnTrail, editingPoiId, editingTrailId]);

  const allOn = Object.values(categoryFilters).every((v) => v);

  return (
    <>
      {/* Load Material Symbols Font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400;600"
      />

      {/* Custom POI Marker Styles */}
      <style>{`
        .map-legend {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1rem 1.2rem;
          box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12);
          min-width: 190px;
        }

        .map-legend__title {
          margin: 0 0 0.75rem;
          font-size: 0.82rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
        }

        .map-legend__item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.25rem 0;
        }

        .map-legend__swatch {
          width: 44px;
          border-top: 4px solid var(--line-color, #2563eb);
          border-radius: 999px;
        }

        .map-legend__item[data-dashed="true"] .map-legend__swatch {
          border-top-style: dashed;
        }

        .map-legend__label {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.92rem;
        }

        .poi-marker {
          background: transparent !important;
          border: none !important;
        }

        .poi-marker__bubble {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--poi-accent, #1fa74d);
          color: var(--poi-accent, #1fa74d);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.22);
          position: relative;
        }

        .poi-marker__bubble::after {
          content: "";
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 10px solid var(--poi-accent, #1fa74d);
        }

        .poi-marker__bubble .material-symbols-outlined {
          font-size: 22px;
          font-variation-settings: "wght" 500;
        }
      `}</style>

      <div
        className="relative rounded-3xl border border-gray-200 bg-gray-100 shadow-xl overflow-hidden"
        style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
      >
        {/* Map Container */}
        <div
          ref={mapRef}
          className="absolute inset-0 z-0"
          style={{ zIndex: 0 }}
        />

        {/* Sidebar Panel */}
        <aside
          className="absolute top-6 left-6 w-80 max-h-[calc(100%-3rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ zIndex: 1000 }}
        >
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Map Editor</h2>
            <p id="map-instruction" className="text-sm text-gray-500 mt-1">
              {instructionMessage}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Action Buttons */}
            {!mode && (
              <div className="space-y-2">
                <button
                  onClick={handleStartAddPOI}
                  className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition disabled:bg-emerald-300"
                  disabled={submitting}
                >
                  Add a Point
                </button>
                <button
                  onClick={handleStartAddTrail}
                  className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition disabled:bg-emerald-300"
                  disabled={submitting}
                >
                  Add a Track
                </button>
              </div>
            )}

            {mode && (
              <button
                onClick={handleCancelMode}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                ← Cancel
              </button>
            )}

            {/* Form when adding POI */}
            {showForm && mode === "add-poi" && (
              <form
                onSubmit={handleFormSubmit}
                className="space-y-4 border-t border-gray-200 pt-4"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {editingPoiId ? "Edit Point" : "New Point"}
                </div>

                <div className="mb-2">
                  {selectedLocation ? (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-900 mb-1">
                            Location Confirmed
                          </div>
                          <div className="text-xs text-green-700">
                            {selectedLocation.lat.toFixed(6)},{" "}
                            {selectedLocation.lng.toFixed(6)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedLocation(null)}
                          className="text-green-700 hover:text-green-900 underline text-xs font-semibold"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                      Click on the map to choose a location for this point.
                    </div>
                  )}
                </div>

                {/* Icon/Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose Icon (Category) *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map((cat) => {
                      const slug = cat.slug || cat.icon || String(cat.id);
                      const iconPath =
                        categoryIconPathMap[cat.id] ||
                        categoryIconPathMap[slug] ||
                        getAssetUrl("/assets/icons/categories/default.svg");
                      const accent = categoryColors[slug] || "#1fa74d";
                      const isSelected = formData.category_id === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              category_id: cat.id,
                            }))
                          }
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                          title={cat.label}
                        >
                          <div
                            className="w-8 h-8 flex items-center justify-center"
                            style={{
                              border: `2px solid ${
                                isSelected ? accent : "#e5e7eb"
                              }`,
                              borderRadius: "50%",
                              background: isSelected ? `${accent}20` : "white",
                            }}
                          >
                            <img
                              src={iconPath}
                              alt={cat.label}
                              style={{
                                width: "18px",
                                height: "18px",
                                filter: isSelected
                                  ? "none"
                                  : "grayscale(60%) opacity(60%)",
                              }}
                              onError={(e) => {
                                e.target.src = getAssetUrl(
                                  "/assets/icons/categories/default.svg"
                                );
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 text-center leading-tight">
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!formData.category_id && (
                    <p className="mt-1 text-xs text-red-500">
                      Please select a category
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Title of the point"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Optional description..."
                  />
                </div>

                {/* Visibility */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public_poi"
                    checked={formData.is_public}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_public: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300"
                  />
                  <label
                    htmlFor="is_public_poi"
                    className="text-sm text-gray-700"
                  >
                    Visible to public
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={
                    !formData.category_id ||
                    !formData.name ||
                    !selectedLocation ||
                    submitting
                  }
                  className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed transition"
                >
                  {submitting ? "Saving..." : editingPoiId ? "Update" : "Save"}
                </button>
              </form>
            )}

            {showForm && mode === "add-trail" && (
              <form
                onSubmit={handleFormSubmit}
                className="space-y-3 border-t border-gray-200 pt-4"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {editingTrailId ? "Edit Trail" : "New Trail"}
                </div>

                {/* Drawing Status */}
                {!drawnTrail ? (
                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    {editingTrailId
                      ? "Draw the updated path for this track using the tools on the map."
                      : "Use the drawing tools on the map to draw your trail path"}
                  </div>
                ) : (
                  <div className="text-xs text-green-600 bg-green-50 p-3 rounded-lg border border-green-200 flex items-start justify-between">
                    <div>
                      {editingTrailId
                        ? "Existing trail path loaded. Use Redraw to replace it."
                        : "Trail path drawn successfully"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrailGeometry(null)}
                      className="text-green-700 hover:text-green-900 underline"
                    >
                      Redraw
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trail Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Northern Section"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRAIL_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Style preview</span>
                      <span>{selectedTrailStyle.label}</span>
                    </div>
                    <svg className="mt-2 h-3 w-full">
                      <line
                        x1="0"
                        y1="6"
                        x2="100%"
                        y2="6"
                        stroke={selectedTrailStyle.color}
                        strokeWidth={selectedTrailStyle.weight}
                        strokeDasharray={
                          selectedTrailStyle.dashArray || undefined
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {selectedTrailStyle.dashArray
                        ? `Dashed pattern ${selectedTrailStyle.dashArray}`
                        : "Solid line"}{" "}
                      • Width {selectedTrailStyle.weight}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public_trail"
                    checked={formData.is_public}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_public: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300"
                  />
                  <label
                    htmlFor="is_public_trail"
                    className="text-sm text-gray-700"
                  >
                    Visible to public
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!formData.name || !drawnTrail || submitting}
                  className="w-full inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed transition"
                >
                  {submitting
                    ? "Saving..."
                    : editingTrailId
                    ? "Update Trail"
                    : "Save Trail"}
                </button>
              </form>
            )}

            {/* Category Filters */}
            {!mode && (
              <>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Activities
                    </h3>
                    <button
                      onClick={handleToggleAll}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      {allOn ? "Turn off all" : "Turn on all"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {categories.map((category) => {
                      const slug =
                        category.slug || category.icon || String(category.id);
                      const iconPath =
                        categoryIconPathMap[category.id] ||
                        categoryIconPathMap[slug] ||
                        getAssetUrl("/assets/icons/categories/default.svg");
                      const accent = categoryColors[slug] || "#1fa74d";

                      return (
                        <label
                          key={category.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white cursor-pointer transition-all"
                          style={{
                            borderColor: categoryFilters[slug]
                              ? accent
                              : undefined,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 flex items-center justify-center rounded-full"
                              style={{
                                border: `2px solid ${accent}`,
                                background: categoryFilters[slug]
                                  ? `${accent}20`
                                  : "white",
                              }}
                            >
                              <img
                                src={iconPath}
                                alt={category.label}
                                style={{ width: "20px", height: "20px" }}
                                onError={(e) => {
                                  e.target.src = getAssetUrl(
                                    "/assets/icons/categories/default.svg"
                                  );
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {category.label}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={categoryFilters[slug] || false}
                            onChange={() => handleToggleCategory(slug)}
                            className="rounded border-gray-300 focus:ring-green-500"
                            style={{ accentColor: accent }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {activeTrail && (
          <div
            className="absolute top-6 right-6 w-96 max-w-[90vw] z-[1010]"
            role="dialog"
            aria-label={`Details for ${activeTrail.name}`}
          >
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl">
              <div
                className="relative h-16"
                style={{
                  background: `linear-gradient(135deg, ${activeTrailAccent}, ${activeTrailAccent}33)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-between px-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/90">
                    {activeTrail.statusLabel ||
                      activeTrailStyle?.label ||
                      activeTrail.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTrail(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-gray-900"
                    aria-label="Close details"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {activeTrail.isPublic ? "Public" : "Hidden"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => focusTrailOnMap(activeTrail)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Center map
                    </button>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {activeTrail.name}
                  </h3>
                  {activeTrail.legendLabel && (
                    <div className="text-xs text-gray-500">
                      Legend label: {activeTrail.legendLabel}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  {activeTrail.description || "No description provided yet."}
                </p>

                <div className="space-y-1 text-xs text-gray-500">
                  <div>
                    <span className="font-semibold text-gray-600">Status:</span>{" "}
                    {activeTrail.statusLabel ||
                      activeTrailStyle?.label ||
                      activeTrail.status}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">
                      Visibility:
                    </span>{" "}
                    {activeTrail.isPublic ? "Public" : "Hidden"}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => startEditingTrail(activeTrail)}
                    className="flex-1 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed"
                    disabled={trailDeletingId === activeTrail.id}
                  >
                    Edit Track
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrail(activeTrail)}
                    className="flex-1 inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={trailDeletingId === activeTrail.id}
                  >
                    {trailDeletingId === activeTrail.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePoi && (
          <div
            className="absolute top-6 right-6 w-96 max-w-[90vw] z-[1010]"
            role="dialog"
            aria-label={`Details for ${activePoi.name}`}
          >
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={() => setActivePoi(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-gray-900 z-10"
                aria-label="Close details"
              >
                ×
              </button>

              <div className="space-y-4 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <span>{resolveCategoryLabel(activePoi.category)}</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                      {activePoi.isPublic ? "Public" : "Hidden"}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {activePoi.name}
                  </h3>
                </div>

                <p className="text-sm text-gray-600">
                  {activePoi.description || "No description provided yet."}
                </p>

                <div className="space-y-2 text-xs text-gray-500">
                  {(() => {
                    if (
                      activePoi.lat === null ||
                      activePoi.lat === undefined ||
                      activePoi.lat === "" ||
                      activePoi.lng === null ||
                      activePoi.lng === undefined ||
                      activePoi.lng === ""
                    ) {
                      return null;
                    }
                    const lat = Number(activePoi.lat);
                    const lng = Number(activePoi.lng);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                      return null;
                    }
                    return (
                      <div>
                        <span className="font-semibold text-gray-600">
                          Location:
                        </span>{" "}
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </div>
                    );
                  })()}
                  {activePoi.gmaps && (
                    <a
                      href={activePoi.gmaps}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <span className="material-symbols-outlined text-base">
                        map
                      </span>
                      Open in Google Maps
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => startEditingPoi(activePoi)}
                    className="flex-1 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed"
                    disabled={poiDeletingId === activePoi.id}
                  >
                    Edit Point
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePoi(activePoi)}
                    className="flex-1 inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={poiDeletingId === activePoi.id}
                  >
                    {poiDeletingId === activePoi.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center"
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
