export const normalizeFeature = (input) => {
  if (!input) return null;
  if (input.type === "Feature") {
    return {
      type: "Feature",
      geometry: input.geometry ? { ...input.geometry } : null,
      properties: { ...(input.properties || {}) },
    };
  }
  if (input.type === "FeatureCollection") {
    const features = (input.features || []).map(normalizeFeature).filter(Boolean);
    return { type: "FeatureCollection", features };
  }
  if (input.type && input.coordinates) {
    return {
      type: "Feature",
      geometry: { type: input.type, coordinates: input.coordinates },
      properties: {},
    };
  }
  return null;
};

export const mergeGeoJsonItems = (items) => {
  const features = [];
  items.forEach((item) => {
    const normalized = normalizeFeature(item);
    if (!normalized) return;
    if (normalized.type === "FeatureCollection") {
      (normalized.features || []).forEach((feat) => {
        if (feat) features.push(feat);
      });
    } else {
      features.push(normalized);
    }
  });

  if (features.length === 0) return null;
  if (features.length === 1) return features[0];
  return { type: "FeatureCollection", features };
};

export const cloneGeoJSON = (data) => {
  if (!data) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to clone GeoJSON payload", error);
    return data;
  }
};

export const hasCoordinates = (geojson) => {
  if (!geojson) return false;

  const type = geojson.type;

  if (type === "FeatureCollection") {
    return Array.isArray(geojson.features)
      ? geojson.features.some((feature) => hasCoordinates(feature))
      : false;
  }

  if (type === "Feature") {
    return hasCoordinates(geojson.geometry);
  }

  if (type === "GeometryCollection") {
    return Array.isArray(geojson.geometries)
      ? geojson.geometries.some((geometry) => hasCoordinates(geometry))
      : false;
  }

  if (
    (type === "LineString" ||
      type === "MultiLineString" ||
      type === "Polygon" ||
      type === "MultiPolygon") &&
    Array.isArray(geojson.coordinates)
  ) {
    return geojson.coordinates.length > 0;
  }

  return false;
};

