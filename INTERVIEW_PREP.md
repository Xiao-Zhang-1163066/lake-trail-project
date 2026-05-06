# Interview Prep — Te Waihora Trail

## How to introduce the project

> "Te Waihora Trail is a full-stack admin portal I built for a New Zealand community trail project. The frontend is React with a Leaflet-based interactive map editor where staff can create and manage trails and points of interest. The most interesting challenge was bridging React's declarative model with Leaflet's imperative API — the map lives outside React's tree entirely, so I had to manage initialisation, layer rendering, and event handling through refs and effects. I also built the state management layer using a reducer pattern to handle the complex multi-field state transitions in the editor."

---

## Frontend — Map Editor

### React fundamentals

Q: How does Leaflet integrate with React?
A: Leaflet is imperative — you issue direct commands to a live object. React is declarative — it describes what the UI should look like. The solution is useRef: you hand Leaflet a DOM node via a ref and React agrees to leave it alone. The map instance, drawn layers, and legend container are all stored in refs, not state, because the UI never needs to re-render when they change.

Q: Why did you use useReducer instead of useState?
A: When multiple pieces of state change together as part of the same action. For example, clicking "cancel" clears mode, activePoiId, activeTrailId, formData, and selectedLocation all at once. With individual useState calls you'd call five setters in sequence. useReducer lets one dispatch handle all five atomically — one action, one re-render.

Q: What is a stale closure and did you encounter one?
A: A stale closure happens when useCallback freezes a function at creation time, capturing variables as they were then. If those variables later change, the function works with outdated data. I encountered it with setFormData inside useCallback — instead of reading formData from the closure, I used the functional update pattern: `setFormData(prev => ({ ...prev }))`. The prev argument is handed directly by the reducer, bypassing the closure entirely.

Q: How do you prevent unnecessary re-renders in a complex component?
A: useMemo for values (sidebarModel, activePoi, activeTrail), useCallback for functions (handlers passed as props), and stable references for setters (useReducer dispatch is stable forever). The key question is: does this value/function get passed as a prop or a useEffect dependency? If yes, stabilise it. If no, don't bother.

---

### Architecture

Q: How did you split responsibilities across hooks?
A: Each hook owns one concern. useMapData owns server data and fetching. useMapEditorUiState owns all editor UI state. useLeafletEditor owns map initialisation and imperative event wiring. useRenderMapLayers owns keeping the map visually in sync with data. InteractiveMapEditor orchestrates all four and handles CRUD operations.

Q: What is lifting state up?
A: All state lives at the top in InteractiveMapEditor. Subcomponents (EditorSidebar, TrailDetailsPanel, PoiDetailsPanel) are dumb — they receive data and callbacks as props and don't manage their own state. Data flows one direction: down as props, up via callbacks.

Q: How does data flow through the component?
A: One direction. State lives at the top. Props flow down to subcomponents. Events bubble up via callbacks. No subcomponent reaches up to modify a sibling's state directly.

Q: Why store ids in state instead of full objects?
A: Normalisation — store the minimum, derive the rest. activePoiId: 3 in state, activePoi derived with pois.find(p => p.id === activePoiId). If you stored the full object, it could go out of sync with the pois array after a refresh. The id is always the source of truth.

---

### Specific decisions

Q: What is the adapter pattern and where did you use it?
A: The adapter bridges two interfaces that don't match. useLeafletEditor and useRenderMapLayers call setActivePoi(poi) with full objects, but state only stores ids. The adapter `const setActivePoi = (poi) => setActivePoiId(poi?.id ?? null)` translates between the two. If the storage format changes, only the adapter needs updating.

Q: What is the upsert pattern?
A: One function handles both create and update. It checks whether an id exists — if yes, PUT (update); if no, POST (create). This avoids duplicating validation and payload-building logic across two separate handlers.

Q: How do you handle async operations and loading states?
A: setSubmitting(true) before the API call, try/catch around the await, finally to call setSubmitting(false) regardless of success or failure. The finally block guarantees the button is never left in a disabled state if the request fails.

Q: What would you do differently if you built this again?
A: Normalise the API to always use slugs in both directions — that would eliminate the id lookup table on the frontend entirely. Replace alert() with a proper toast notification system. Add integration tests for the API layer.

---

### Performance

Q: When does useCallback actually help and when is it useless?
A: It only helps when the consumer uses referential equality — useEffect dependency arrays, or React.memo'd components that bail out when props don't change. If you wrap a function in useCallback but never pass it as a prop or dependency, you're paying the memoisation cost for nothing.

Q: What's the cost of over-memoising?
A: Extra memory to store cached values, harder to read, and a false sense of optimisation. useMemo and useCallback are not free — they add overhead. Only use them when you have a concrete reason.

---

### Leaflet specific

Q: Why do you dynamically import Leaflet instead of a static import?
A: Leaflet touches window on import, which breaks server-side rendering. Dynamic import loads it on demand, after the component mounts. It also means Leaflet only loads when the map editor is opened, not on every page.

Q: What is window.L and why is it needed?
A: leaflet-draw is a legacy plugin that doesn't use ES modules — it looks for Leaflet on the global window object. Setting window.L = L before importing leaflet-draw is a required hack. Without it the plugin crashes.

Q: GeoJSON uses lng/lat but Leaflet uses lat/lng — how do you handle that?
A: L.geoJSON() handles the swap automatically when rendering trails. But raw L.marker() calls use lat/lng directly, so you never pass GeoJSON coordinates to a marker — you use poi.lat and poi.lng which are already in the right order.

Q: How do you prevent wiping the in-progress drawn trail during a redraw?
A: In useRenderMapLayers, before removing any layer we check two things: `layer === drawnLayersRef.current` (skip the FeatureGroup container) and `drawnLayersRef.current?.hasLayer(layer)` (skip anything inside it). Without these guards the drawn polyline gets deleted on every redraw because Leaflet sees it as just another L.Polyline.

---

### Error handling

Q: How do you handle API errors in the editor?
A: try/catch around every async operation. The catch shows the error message to the user. The finally block resets submitting state. This guarantees the UI never gets stuck in a loading state regardless of what the server returns.

Q: What happens if the user's session expires mid-edit?
A: Every API call receives an onUnauthorized callback. If the server returns 401, ensureOk() calls that callback, which calls handleSessionExpired(), which logs the user out and redirects to the login page.

Q: How do you prevent setting state on an unmounted component?
A: A mountedRef flag — useRef(true) on mount, set to false in the useEffect cleanup. Inside the async fetch, check mountedRef.current before calling any setState. React itself doesn't read the flag — your code does. useRef is used instead of useState because flipping the flag should never trigger a re-render.

---

### Depth questions

Q: What's the difference between useEffect cleanup running on unmount vs on dependency change?
A: Cleanup runs before every re-run, not just on unmount. Every time a dependency changes, React runs the cleanup from the previous render before running the effect again. This is how map.off() prevents click handlers from stacking up — the cleanup removes the old listener before the new one is added.

Q: If two useEffects both listen to map clicks, do they stack?
A: Yes — without cleanup they stack. Every time the effect re-runs it registers a new listener on top of the old one. After five mode changes you'd have five click handlers all firing on the same click. That's why every map.on() needs a corresponding map.off() in the cleanup function.

Q: Why does useReducer's dispatch never need to be in a dependency array?
A: React guarantees dispatch is stable — same reference for the entire lifetime of the component. Adding it to a dependency array is harmless but unnecessary. Same guarantee applies to setState from useState.

Q: What's the difference between derived state and redundant state?
A: Derived state is computed from existing state — activePoi derived from activePoiId + pois array. Redundant state is a copy that can go out of sync — storing both activePoiId and activePoi as separate state fields. Derived state is always correct by definition. Redundant state requires manual synchronisation and is a common source of bugs.

---

## Backend

### Architecture

Q: How is the backend structured?
A: Three layers. Routers handle HTTP — parsing requests, auth guards, shaping responses. Services handle business logic — orchestrating repositories and raising AppError. Repositories handle data access — raw SQL via psycopg3, returning dicts. Nothing crosses between layers.

Q: Why separate routers from services?
A: Routers shouldn't contain business logic, services shouldn't know about HTTP status codes. Separation makes each layer independently testable and replaceable. If you swap FastAPI for Flask, only the routers change.

Q: What is AppError and why does it exist?
A: A custom error class raised in services and caught at the router layer. Keeps error handling in one place instead of scattered try/catch across every route. The router catches AppError and maps it to the right HTTP response.

Q: Why FastAPI over Flask or Django?
A: Async support out of the box, automatic OpenAPI docs, modern Python. Flask requires extra libraries for async and validation. Django is too heavyweight for a focused API with no ORM requirement.

---

### Database

Q: How do you query the database?
A: Raw SQL via psycopg3. No ORM — more control, no magic, performant for complex queries like the POI JOIN with categories.

Q: What's the difference between an ORM and raw SQL?
A: An ORM generates SQL for you — faster to write, but hides what's actually running against the database. Raw SQL is explicit — you know exactly what query runs. For complex joins and performance-sensitive queries, raw SQL is the right call.

Q: Why does the API return category as a slug instead of an id?
A: Human readable and decoupled from database internals. The tradeoff is the frontend needs a reverse lookup table to send the numeric id back on writes. In a better design the API would accept slugs on writes too and resolve them server-side.

---

### Authentication

Q: How does auth work?
A: JWT token sent as Authorization: Bearer on every request. Server verifies the token and checks the user's role. admin users have full access, volunteer users can only access /activities.

Q: Where is the token stored on the frontend?
A: localStorage under portal.auth.credentials. Accessible to JavaScript which is an XSS risk, but acceptable for an internal admin portal not exposed to the public.

Q: What are the tradeoffs of localStorage vs httpOnly cookies for JWT?
A: localStorage is accessible to JavaScript — vulnerable to XSS attacks. httpOnly cookies are not accessible to JavaScript — XSS safe, but vulnerable to CSRF instead. For a public-facing app, httpOnly cookies with CSRF protection is the right call. For an internal admin portal, localStorage is pragmatic.

Q: What happens when a token expires?
A: Server returns 401. ensureOk() in the API client catches it and calls onUnauthorized, which calls handleSessionExpired(), which clears the token from localStorage and redirects to the login page.

---

### Deployment

Q: How is the backend deployed?
A: FastAPI running as an ASGI app inside Azure Functions via function_app.py. Azure Functions handles the HTTP trigger and passes it to FastAPI. The advantage is serverless — no server to manage, scales automatically.

Q: What does the API prefix stripper do?
A: Azure Functions adds /api to all routes automatically. The stripper middleware removes it so FastAPI sees clean paths (/trails instead of /api/trails). Without it every route definition would need the /api prefix hardcoded.

Q: How does gallery media storage work?
A: Three backends configurable via environment variables — Supabase Storage, Azure Blob Storage, or local filesystem. Swappable without changing application code. Local filesystem for dev, cloud storage for production.

---

### Harder questions

Q: What's the difference between Supabase anon key and service role key?
A: The anon key has row-level security (RLS) applied — users only see rows they're allowed to see. The service role key bypasses RLS entirely. The backend uses the service role key for admin operations that need unrestricted access.

Q: Why is CORS set to * and what are the risks?
A: Open for local dev convenience — any origin can make requests to the API. In production it should be locked to specific origins. The risk is that any malicious website could make authenticated requests if a user visits it while logged into the portal.

Q: How would you add a new endpoint?
A: Three steps following the layered architecture. Add a repository function with raw SQL that returns a dict. Add a service function that calls the repository and raises AppError on failure. Add a router endpoint that calls the service, handles AppError, and shapes the HTTP response.
