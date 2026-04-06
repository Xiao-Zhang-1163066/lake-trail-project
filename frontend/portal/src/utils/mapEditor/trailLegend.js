import {
  TRAIL_STATUS_OPTIONS,
  getStatusStyle,
} from "../../constants/trailStatuses";

// Generates legend items for trails based on their status and style
/*
"segments": [
        {
            "id": "20",
            "name": "tset",
            "status": "stage-1",
            "description": null,
            "legendLabel": null,
            "statusLabel": "Stage 1",
            "style": {
                "color": "#2563eb",
                "weight": 5
            },
            "isPublic": true,
            "geojson": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [
                            172.450848,
                            -43.707966
                        ],
                        [
                            172.441406,
                            -43.702382
                        ],
                        [
                            172.429047,
                            -43.704491
                        ]
                    ]
                },
                "properties": {}
            }
        },
]
*/
export const buildTrailLegendItems = (segments = []) => {
  const itemsByStatus = new Map();

  segments.forEach((segment) => {
    if (!segment || segment.isPublic === false) return;

    const status = segment.status;
    if (!status || itemsByStatus.has(status)) return; // Skip if no status or already have an item for this status

    const defaultStyle = getStatusStyle(status) || {}; // Get default style for this status, if any
    const segmentStyle = segment.style || {}; // Segment style takes precedence over default status style

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
