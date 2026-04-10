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
