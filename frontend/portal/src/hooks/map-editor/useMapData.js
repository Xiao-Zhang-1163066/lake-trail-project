import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPublicMapData } from "../../services/mapAdminApi";

/**
 * Manages the map's server-side data: POIs, trail segments, categories,
 * derived lookup maps, and the loadMapData refresh function.
 */
export function useMapData() {
  const [pois, setPois] = useState([]);
  const [trails, setTrails] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState({});
  const [loading, setLoading] = useState(true);

  // Track if the component is still mounted to avoid setting state on an unmounted component
  const mountedRef = useRef(true);
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    // The cleanup: don't clear data, just mark as unmounted to prevent state updates
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
      setTrails(trailsData.segments || []);
      setCategories(poisData.categories || []);

      // Build filter state and icon/id lookup maps from categories
      // Build filter state: { toilets: true, carpark: true, ... }
      // Every category starts visible (true)
      const filters = {};
      (poisData.categories || []).forEach((cat) => {
        const key = cat.slug || String(cat.id);
        filters[key] = cat.defaultVisible !== false;
      });
      setCategoryFilters(filters);
    } catch (error) {
      if (mountedRef.current) console.error("Failed to load map data:", error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  return {
    pois,
    trails,
    categories,
    categoryFilters,
    setCategoryFilters,
    loading,
    loadMapData,
  };
}
