import { useState, useEffect, useCallback, useRef } from "react";
import { getAssetUrl } from "../../utils/mapEditor/assetUrl";
import { buildTrailLegendItems } from "../../utils/mapEditor/trailLegend";
import { fetchPublicMapData } from "../../services/mapAdminApi";

/**
 * Manages the map's server-side data: POIs, trail segments, categories,
 * derived lookup maps, and the loadMapData refresh function.
 */
export function useMapData() {
  const [pois, setPois] = useState([]);
  const [trails, setTrails] = useState([]);
  const [trailLegendItems, setTrailLegendItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState({});
  const [categoryIconPathMap, setCategoryIconPathMap] = useState({});
  const [categoryIdMap, setCategoryIdMap] = useState({});

  // Track if the component is still mounted to avoid setting state on an unmounted component
  const mountedRef = useRef(true);
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMapData = useCallback(async () => {
    try {
      setLoading(true);
      const { poisData, trailsData } = await fetchPublicMapData();
      // If the component unmounted while we were loading, don't attempt to set state
      if (!mountedRef.current) return;

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
          })),
        );
      } else {
        setTrailLegendItems([]);
      }

      setCategories(poisData.categories || []);

      // Build filter state and icon/id lookup maps from categories
      const filters = {};
      const iconPathMapById = {};
      const iconPathMapBySlug = {};
      const idMap = {};

      (poisData.categories || []).forEach((cat) => {
        const slug = cat.slug || cat.icon || String(cat.id);
        const iconPath = cat.iconPath
          ? getAssetUrl(cat.iconPath)
          : getAssetUrl("/assets/icons/categories/default.svg");

        filters[slug] = cat.defaultVisible !== false;
        iconPathMapById[cat.id] = iconPath;
        iconPathMapBySlug[slug] = iconPath;
        idMap[slug] = cat.id;
      });

      setCategoryFilters(filters);
      setCategoryIconPathMap({ ...iconPathMapById, ...iconPathMapBySlug });
      setCategoryIdMap(idMap);
    } catch (error) {
      if (mountedRef.current) console.error("Failed to load map data:", error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // All setState deps are stable — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  return {
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
  };
}
