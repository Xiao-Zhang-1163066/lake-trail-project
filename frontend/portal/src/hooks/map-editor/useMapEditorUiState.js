import { useMemo, useReducer } from "react";
import { DEFAULT_TRAIL_STATUS } from "../../constants/trailStatuses";

const initialFormData = {
  type: "poi",
  name: "",
  description: "",
  category_id: "",
  is_public: true,
  status: DEFAULT_TRAIL_STATUS,
};

const initialState = {
  mode: null,
  showForm: false,
  drawnTrail: null,
  activePoi: null,
  editingPoiId: null,
  poiDeletingId: null,
  activeTrail: null,
  editingTrailId: null,
  trailDeletingId: null,
  selectedLocation: null,
  submitting: false,
  formData: initialFormData,
};

function reducer(state, action) {
  switch (action.type) {
    case "set": {
      const current = state[action.key];
      const nextValue =
        typeof action.value === "function"
          ? action.value(current)
          : action.value;
      if (current === nextValue) return state;
      return {
        ...state,
        [action.key]: nextValue,
      };
    }
    case "patch":
      return {
        ...state,
        ...action.value,
      };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

export function useMapEditorUiState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const createSetter = (key) => (value) => {
    dispatch({ type: "set", key, value });
  };

  const setters = useMemo(
    () => ({
      setMode: createSetter("mode"),
      setShowForm: createSetter("showForm"),
      setDrawnTrail: createSetter("drawnTrail"),
      setActivePoi: createSetter("activePoi"),
      setEditingPoiId: createSetter("editingPoiId"),
      setPoiDeletingId: createSetter("poiDeletingId"),
      setActiveTrail: createSetter("activeTrail"),
      setEditingTrailId: createSetter("editingTrailId"),
      setTrailDeletingId: createSetter("trailDeletingId"),
      setSelectedLocation: createSetter("selectedLocation"),
      setSubmitting: createSetter("submitting"),
      setFormData: createSetter("formData"),
      patchUiState: (value) => dispatch({ type: "patch", value }),
      resetUiState: () => dispatch({ type: "reset" }),
    }),
    [],
  );

  return {
    ...state,
    ...setters,
  };
}
