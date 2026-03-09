import {
  TRAIL_STATUS_OPTIONS,
  getStatusStyle,
} from "../../constants/trailStatuses";

export const buildTrailLegendItems = (segments = []) => {
  const itemsByStatus = new Map();

  segments.forEach((segment) => {
    if (!segment || segment.isPublic === false) return;

    const status = segment.status;
    if (!status || itemsByStatus.has(status)) return;

    const defaultStyle = getStatusStyle(status) || {};
    const segmentStyle = segment.style || {};

    itemsByStatus.set(status, {
      id: status,
      label:
        segment.legendLabel ||
        segment.statusLabel ||
        defaultStyle.label ||
        segment.name ||
        "Trail",
      color: segmentStyle.color || defaultStyle.color || "#3B82F6",
      dashArray: segmentStyle.dashArray ?? defaultStyle.dashArray ?? null,
    });
  });

  const orderedItems = [];

  TRAIL_STATUS_OPTIONS.forEach(({ value }) => {
    if (itemsByStatus.has(value)) {
      orderedItems.push(itemsByStatus.get(value));
      itemsByStatus.delete(value);
    }
  });

  itemsByStatus.forEach((item) => {
    orderedItems.push(item);
  });

  return orderedItems;
};

