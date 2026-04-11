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
