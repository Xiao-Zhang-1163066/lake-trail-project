export const TRAIL_STATUS_STYLES = {
  "stage-1": {
    label: "Stage 1",
    color: "#2563eb",
    weight: 5,
    dashArray: null,
  },
  "stage-2": {
    label: "Stage 2",
    color: "#2563eb",
    weight: 5,
    dashArray: "8 6",
  },
  existing: {
    label: "Existing Trail",
    color: "#0f766e",
    weight: 5,
    dashArray: null,
  },
};

export const TRAIL_STATUS_OPTIONS = Object.entries(TRAIL_STATUS_STYLES).map(
  ([value, config]) => ({
    value,
    label: config.label,
  })
);

export const DEFAULT_TRAIL_STATUS = "stage-1";

export function getStatusStyle(status) {
  return TRAIL_STATUS_STYLES[status] ?? TRAIL_STATUS_STYLES[DEFAULT_TRAIL_STATUS];
}
