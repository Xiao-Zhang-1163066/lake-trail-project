import { TRAIL_STATUS_OPTIONS, getStatusStyle } from "../../constants/trailStatuses";

export const buildTrailLegendItems = (segments = []) => {
  const activeStatuses = new Set(
    segments.filter((s) => s?.isPublic !== false).map((s) => s.status)
  );

  return TRAIL_STATUS_OPTIONS
    .filter(({ value }) => activeStatuses.has(value))
    .map(({ value, label }) => {
      const { color, dashArray } = getStatusStyle(value);
      return { id: value, label, color, dashArray: dashArray ?? null };
    });
};
