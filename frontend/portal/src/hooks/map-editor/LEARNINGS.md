# Map Editor — Rebuild Learnings

## Phase 1 — useMapData

**What this module does**
Fetches POIs, trails, and categories from the API on mount, builds category filter state, and exposes a `loadMapData` function so the UI can re-fetch after a save.

**Key design decision**
`loadMapData` is wrapped in `useCallback` and used as the dependency of a second `useEffect`. This separates "define the fetch" from "trigger it on mount", and makes the function stable enough to be called manually from outside the hook (e.g. after a trail is saved) without causing infinite re-render loops.

**One thing I found surprising**
The cleanup function in `useEffect` doesn't clear state on unmount — it just flips a `useRef` flag to `false`. You check that flag inside the async function before calling `setState`. React itself doesn't read the flag; your code does. If you skip the check, React will try to set state on a gone component and warn you.

**Interview Q&A**

Q: Why use `useRef` instead of `useState` for the mounted flag?
A: `useState` triggers a re-render every time it changes. We don't want a re-render — we just need a mutable value that persists across renders. `useRef` gives you `.current` which you can read and write freely without causing any renders.

Q: Why wrap `loadMapData` in `useCallback`?
A: Without `useCallback`, a new function reference is created on every render. If that function is a dependency of `useEffect`, the effect would re-run on every render — an infinite loop. `useCallback` stabilises the reference so the effect only runs once (on mount).

## Phase 2 — useMapEditorUiState

**What this module does**
Manages all UI state for the map editor — mode, active/editing/deleting IDs, form data, selected location, drawn trail — using a single `useReducer`. Exposes clean setter functions so callers never write `dispatch` directly.

**Key design decision**
Instead of one action type per field, the reducer has three generic types: `set` (one field), `patch` (multiple fields at once), and `reset`. This keeps the action count small while still supporting atomic multi-field updates — which the editor needs frequently (e.g. cancel clears 5 fields at once).

**One thing I found surprising**
`createSetter` is a function that returns a function — a factory. Calling `createSetter("mode")` produces `(value) => dispatch({ type: "set", key: "mode", value })`. This avoids writing the same dispatch boilerplate 11 times. All the setters are wrapped in a single `useMemo([])` so they're created once and never recreated.

**Interview Q&A**

Q: Why does `setFormData` accept a function argument like `prev => ({ ...prev, name: "x" })`?
A: This is the functional update pattern. If `setFormData` is inside a `useCallback`, the `formData` variable in the closure may be stale. Passing a function receives the actual current value from the reducer directly, bypassing the stale closure problem.

Q: When would you choose `useReducer` over multiple `useState` calls?
A: When multiple pieces of state change together as part of the same action. If you find yourself calling `setX`, `setY`, `setZ` in sequence for the same event, that's a sign the state belongs in a reducer where one dispatch handles all three atomically.

Q: What is a stale closure, and how do you fix it?
A: A stale closure happens when a function created by `useCallback` captures a variable (e.g. `formData`) at the time it was created, and that variable later changes — but the function is never recreated because of its dependency array. The function is now working with an outdated value. The fix is the functional update pattern: instead of reading the variable from the closure (`setFormData({ ...formData })`), you pass a function to the setter (`setFormData(prev => ({ ...prev }))`). The `prev` argument is handed to you directly by the reducer, bypassing the closure entirely.

## Phase 3 — useLeafletEditor

**What this module does**
Initialises the Leaflet map once on mount, manages the draw toolbar (adding/removing it based on mode), and wires up map click handlers for POI placement and POI dismissal.

**Key design decision**
Leaflet is imperative — it owns the DOM node it renders into. React is declarative — it wants to own the DOM. The solution is `useRef`: you hand Leaflet a DOM node via a ref and React agrees to leave it alone. The map instance, drawn layers, and legend container are all stored in refs, not state, because the UI never needs to re-render when they change.

**One thing I found surprising**
`window.L = L` is required before importing leaflet-draw. leaflet-draw is an old-school plugin that doesn't use ES modules — it looks for Leaflet on the global `window` object. If you don't put it there first, the plugin crashes. This is a known hack in the Leaflet ecosystem.

**Interview Q&A**

Q: Why store the Leaflet map instance in a `useRef` instead of `useState`?
A: The map instance is an imperative handle — you use it to issue commands (`map.addLayer`, `map.fitBounds`), not to drive rendering. If it were state, every pan, zoom, or click Leaflet makes internally would trigger a React re-render, which would re-run effects and try to reinitialise the map on top of itself. `useRef` lets Leaflet mutate freely without React knowing.

Q: Why must every `map.on(...)` inside a `useEffect` have a corresponding `map.off(...)` in the cleanup?
A: Without cleanup, every time the effect re-runs (e.g. when mode changes) a new listener is registered on top of the old one. After several mode changes you'd have multiple handlers all firing on the same click. The cleanup removes the previous listener before the next one is added.

Q: What goes in a `useEffect` dependency array?
A: Whatever values the effect reads to decide what to do. If the effect checks `mode` to decide whether to add a listener, `mode` goes in the array. If it reads `activePoi` to decide whether to register a dismiss handler, `activePoi` goes in the array. The array should reflect what the effect actually depends on — not more, not less.

## Phase 4 — useRenderMapLayers

**What this module does**
Keeps the Leaflet map visually in sync with React state. On every data change it wipes all POI markers and trail polylines from the map and redraws them from scratch — rendering trail polylines styled by status, a legend, POI markers filtered by category, and a temporary marker for new POI placement.

**Key design decision**
Full redraw on every change rather than diffing. Leaflet has no diffing mechanism — tracking which layers correspond to which data items and surgically updating only what changed would require 100+ lines of bookkeeping. For a small dataset a full redraw is imperceptible to the user and far simpler to reason about.

**One thing I found surprising**
The legend is built with raw DOM manipulation (`document.createElement`) rather than JSX. That's because it lives inside a Leaflet control container which is outside React's tree entirely — React can't render into it. Any time you need to inject UI into a third-party library's DOM node, you have to go imperative.

**Interview Q&A**

Q: Why is the entire render logic inside a single `useEffect`?
A: Everything in this hook is a side effect — imperative commands to a Leaflet map that lives outside React's tree. React can't manage Leaflet layers declaratively, so we take full control inside `useEffect` and redraw manually when the data changes.

Q: How do you avoid wiping the user's in-progress drawn trail during a redraw?
A: We check two things before removing a layer: `layer === drawnLayersRef.current` (skip the FeatureGroup container) and `drawnLayersRef.current?.hasLayer(layer)` (skip anything inside it). Without these guards, the drawn polyline would be deleted on every redraw because Leaflet sees it as just another `L.Polyline`.

Q: Why does GeoJSON need a `hasCoordinates` check before passing to Leaflet?
A: GeoJSON can come from the database in several shapes — `Feature`, `FeatureCollection`, raw `LineString` — and some records may have empty or malformed geometry. Passing invalid GeoJSON to `L.geoJSON()` either crashes or silently draws nothing. `hasCoordinates` recursively unwraps the GeoJSON structure and confirms there are actual coordinates before we attempt to render.

## Phase 5 — InteractiveMapEditor

**What this module does**
The top-level orchestrator. Calls all four hooks, derives state from raw data, handles all CRUD operations for POIs and trails, and passes everything down to dumb subcomponents via props. It owns all state and logic — the subcomponents just render what they receive.

**Key design decision**
Lifting state up — all state lives at the top in this component. Subcomponents (`EditorSidebar`, `TrailDetailsPanel`, `PoiDetailsPanel`) are dumb: they receive data and callbacks as props and don't manage their own state. This makes data flow one-directional and predictable. The `sidebarModel` object bundles all sidebar props into one structured object instead of passing 20 individual props.

**One thing I found surprising**
`setTrailGeometry` cannot be inside the reducer even though it updates state. It's a `useCallback` that does two things: updates React state (`setDrawnTrail`) AND imperatively clears the Leaflet drawn layers. Reducers are pure functions — no side effects allowed. So the two calls in `handleCancelMode` are intentionally separate: `patchUiState` for the pure state update, `setTrailGeometry(null)` for the Leaflet side effect.

**Interview Q&A**

Q: What is the adapter pattern and where is it used here?
A: The adapter pattern bridges two interfaces that don't match. `useLeafletEditor` and `useRenderMapLayers` call `setActivePoi(poi)` with full objects, but state only stores ids. The adapter `const setActivePoi = (poi) => setActivePoiId(poi?.id ?? null)` translates between the two. If the internal storage format changes, only the adapter needs updating — the hooks stay untouched.

Q: Why does `handleCancelMode` need to call both `patchUiState` and `setTrailGeometry(null)` separately?
A: `patchUiState` only updates fields inside the reducer — pure state, no side effects. `setTrailGeometry` also imperatively clears Leaflet's drawn layers, which lives outside the reducer. Reducers must be pure functions, so the Leaflet side effect can't live inside one. The two calls are intentionally separate.

Q: What is the upsert pattern?
A: One function handles both create and update. It checks whether an id exists — if yes, PUT (update); if no, POST (create). This avoids duplicating validation and payload-building logic across two separate handlers. `upsertTrail` and `upsertPoi` both follow this pattern.
