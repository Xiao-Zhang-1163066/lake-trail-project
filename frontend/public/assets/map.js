/* Te Waihora Trail Map - Interactive Map Controller */

(function () {
  // DOM Elements
  const elements = {
    loader: document.getElementById("map-loader"),
    filtersStatus: document.getElementById("filters-status"),
    filterGroups: document.getElementById("filter-groups"),
    toggleAll: document.getElementById("toggle-all"),
    overlay: document.getElementById("map-overlay"),
    toggleBtn: document.getElementById("toolbar-toggle"),
    closeBtn: document.getElementById("overlay-close"),
  };

  // State
  const state = {
    categoryState: {},
    checkboxMap: new Map(),
    poiLayers: new Map(),
    categoryIconPathMap: new Map(),
    bounds: L.latLngBounds([]),
    overlayIsOpen: false,
    categoryAliases: new Map(),
  };

  // Configuration
  const config = {
    categoryColors: {
      cycling: "#0ea5e9",
      camping: "#047857",
      kayaking: "#2563eb",
      bird: "#0f766e",
      fishing: "#7c3aed",
      trailhead: "#ea580c",
      parking: "#475569",
      restroom: "#14b8a6",
    },
    statusLabels: {
      existing: "Existing Trail",
      "stage-1": "Stage 1",
      "stage-2": "Stage 2",
    },
    defaultIconPath: "/assets/icons/categories/default.svg",
  };

  const STATUS_ORDER = ["existing", "stage-1", "stage-2"];

  function normalizeStatus(value) {
    if (!value) return "";
    const key = String(value)
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-");
    return STATUS_ORDER.includes(key) ? key : "";
  }

  // Responsive
  const mobileMq = window.matchMedia("(max-width: 768px)");

  /* ===== Overlay Management ===== */
  function setOverlayState(open, { skipFocus = false } = {}) {
    state.overlayIsOpen = Boolean(open);
    const overlayVisible = state.overlayIsOpen || !mobileMq.matches;

    elements.overlay?.classList.toggle("is-open", overlayVisible);

    if (elements.toggleBtn) {
      const buttonActive = state.overlayIsOpen && mobileMq.matches;
      elements.toggleBtn.setAttribute(
        "aria-expanded",
        buttonActive ? "true" : "false"
      );
      elements.toggleBtn.classList.toggle(
        "map-toggle-button--active",
        buttonActive
      );
      elements.toggleBtn.setAttribute(
        "aria-label",
        buttonActive ? "Hide map filters" : "Show map filters"
      );
    }

    document.body.classList.toggle(
      "map-overlay-open",
      state.overlayIsOpen && mobileMq.matches
    );

    if (state.overlayIsOpen && !skipFocus && mobileMq.matches) {
      elements.overlay?.querySelector(".map-filters")?.focus();
    }
  }

  function syncOverlayToViewport(mq) {
    setOverlayState(!mq.matches, { skipFocus: true });
  }

  /* ===== Icon & Popup Creation ===== */
  function createMarkerIcon(iconPath, accent) {
    const safeAccent = accent || "#1fa74d";
    const safeIconPath = iconPath || config.defaultIconPath;
    return L.divIcon({
      html: `
        <div class="poi-marker-container" style="
          width: 42px;
          height: 42px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid ${safeAccent};
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        ">
          <img
            src="${safeIconPath}"
            alt="POI"
            style="width: 22px; height: 22px;"
            onerror="this.src='${config.defaultIconPath}'"
          />
        </div>
      `,
      className: "poi-marker",
      iconSize: [42, 48],
      iconAnchor: [21, 42],
      popupAnchor: [0, -36],
    });
  }

  function createPoiPopup(poi, accent) {
    // Image display temporarily disabled
    // const imageHtml = poi.image
    //   ? `<div class="poi-popup__image" style="background-image: url('${poi.image}')"></div>`
    //   : "";
    const navButton = poi.gmaps
      ? `<a class="map-button" href="${poi.gmaps}" target="_blank" rel="noopener">
          <span class="material-symbols-outlined">near_me</span>Directions
        </a>`
      : "";

    return `
      <article class="poi-popup" style="--poi-accent: ${accent}">
        <div class="poi-popup__body">
          <h3 class="poi-popup__title">${poi.name}</h3>
          <p class="poi-popup__description">${poi.description || ""}</p>
          ${navButton}
        </div>
      </article>
    `;
  }

  function createSegmentPopup(segment, accent) {
    const statusKey = normalizeStatus(segment.status);
    const statusLabel =
      segment.statusLabel ||
      (statusKey ? config.statusLabels[statusKey] : null) ||
      segment.legendLabel ||
      segment.status ||
      "Trail segment";
    return `
      <article class="segment-popup" style="--segment-accent: ${accent}">
        <span class="segment-popup__status segment-popup__status--${
          statusKey || "unknown"
        }">${statusLabel}</span>
        <div class="segment-popup__header">
          <h3>${segment.name}</h3>
        </div>
        <p>${segment.description || ""}</p>
      </article>
    `;
  }

  /* ===== Category Management ===== */
  function resolveCategoryKey(categoryId) {
    if (!categoryId) return "";
    if (state.categoryState.hasOwnProperty(categoryId)) return categoryId;
    const alias = state.categoryAliases.get(String(categoryId));
    return alias || String(categoryId);
  }

  function updateCategoryVisibility(categoryId) {
    const key = resolveCategoryKey(categoryId);
    const layer = state.poiLayers.get(key);
    if (!layer) return;

    if (state.categoryState[key]) {
      layer.addTo(window.trailMap);
    } else {
      window.trailMap.removeLayer(layer);
    }
  }

  function refreshToggleAllLabel() {
    const values = Object.values(state.categoryState);
    if (!values.length) {
      elements.toggleAll.disabled = true;
      elements.toggleAll.textContent = "Turn off all";
      return;
    }
    elements.toggleAll.disabled = false;
    const allOn = values.every(Boolean);
    elements.toggleAll.textContent = allOn ? "Turn off all" : "Turn on all";
  }

  function setupCategories(categories) {
    elements.filterGroups.innerHTML = "";
    state.categoryIconPathMap.clear();
    state.categoryAliases.clear();
    state.categoryState = {};
    state.checkboxMap.clear();
    state.poiLayers.clear();

    if (!Array.isArray(categories) || !categories.length) {
      elements.filtersStatus.textContent = "No categories available.";
      refreshToggleAllLabel();
      return;
    }

    // Group categories
    const groups = {};
    categories.forEach((cat) => {
      const groupName = cat.group || "Other";
      groups[groupName] = groups[groupName] || [];
      groups[groupName].push(cat);
    });

    // Render groups
    Object.keys(groups).forEach((groupName) => {
      const section = document.createElement("section");
      section.className = "filter-group";

      const title = document.createElement("h3");
      title.className = "filter-group__title";
      title.textContent = groupName;
      section.appendChild(title);

      const list = document.createElement("div");
      list.className = "filter-group__list";

      groups[groupName].forEach((cat) => {
        const slug = cat.slug || cat.icon || String(cat.id);
        const key = slug;
        const accent = config.categoryColors[slug] || "#1fa74d";
        const iconPath = cat.iconPath || config.defaultIconPath;

        // Store icon paths
        state.categoryIconPathMap.set(cat.id, iconPath);
        state.categoryIconPathMap.set(slug, iconPath);
        state.categoryAliases.set(String(cat.id), key);
        state.categoryAliases.set(slug, key);

        // Create filter toggle
        const label = document.createElement("label");
        label.className = "filter-toggle";
        label.style.setProperty("--accent", accent);

        const infoWrapper = document.createElement("span");
        infoWrapper.className = "filter-toggle__info";

        // Icon
        const iconContainer = document.createElement("span");
        iconContainer.className = "filter-toggle__icon";
        const iconImg = document.createElement("img");
        iconImg.src = iconPath;
        iconImg.alt = cat.label || cat.id;
        iconImg.onerror = () => (iconImg.src = config.defaultIconPath);
        iconContainer.appendChild(iconImg);
        infoWrapper.appendChild(iconContainer);

        // Label
        const textSpan = document.createElement("span");
        textSpan.className = "filter-toggle__label";
        textSpan.textContent = cat.label || cat.id;
        infoWrapper.appendChild(textSpan);

        // Checkbox
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "filter-toggle__input";
        input.dataset.category = key;
        input.checked = cat.defaultVisible !== false;
        state.categoryState[key] = input.checked;
        state.checkboxMap.set(key, input);
        const layerGroup = L.layerGroup();
        state.poiLayers.set(key, layerGroup);
        state.poiLayers.set(String(cat.id), layerGroup);

        input.addEventListener("change", () => {
          state.categoryState[key] = input.checked;
          updateCategoryVisibility(key);
          refreshToggleAllLabel();
        });

        // Switch
        const switchEl = document.createElement("span");
        switchEl.className = "filter-toggle__switch";

        label.appendChild(infoWrapper);
        label.appendChild(input);
        label.appendChild(switchEl);
        list.appendChild(label);
      });

      section.appendChild(list);
      elements.filterGroups.appendChild(section);
    });

    refreshToggleAllLabel();
  }

  /* ===== POI & Trail Rendering ===== */
  function plotPois(pois) {
    if (!Array.isArray(pois)) return;

    pois.forEach((poi) => {
      if (poi?.isPublic === false) return;

      const lat = Number(poi?.lat);
      const lng = Number(poi?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const categoryKey = resolveCategoryKey(poi.category);

      if (!state.poiLayers.has(categoryKey)) {
        const layerGroup = L.layerGroup();
        state.poiLayers.set(categoryKey, layerGroup);
      }

      if (!state.categoryState.hasOwnProperty(categoryKey)) {
        state.categoryState[categoryKey] = true;
      }

      const accent = config.categoryColors[categoryKey] || "#1fa74d";
      const iconPath =
        state.categoryIconPathMap.get(categoryKey) || config.defaultIconPath;

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(iconPath, accent),
        title: poi.name,
        riseOnHover: true,
      });

      marker.bindPopup(createPoiPopup(poi, accent), {
        className: "poi-popup-container",
      });

      const layer = state.poiLayers.get(categoryKey);
      layer.addLayer(marker);
      state.bounds.extend(marker.getLatLng());
    });

    Object.keys(state.categoryState).forEach(updateCategoryVisibility);
  }

  function renderLegend(items) {
    if (!Array.isArray(items) || !items.length) return;

    const legendControl = L.control({ position: "topright" });
    legendControl.onAdd = () => {
      const container = L.DomUtil.create("div", "map-legend");

      const title = document.createElement("div");
      title.className = "map-legend__title";
      title.textContent = "Trail status";
      container.appendChild(title);

      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "map-legend__item";
        if (item.dashArray) row.setAttribute("data-dashed", "true");

        const swatch = document.createElement("span");
        swatch.className = "map-legend__swatch";
        swatch.style.setProperty("--line-color", item.color || "#2563eb");
        row.appendChild(swatch);

        const label = document.createElement("span");
        label.className = "map-legend__label";
        label.textContent = item.label || item.id;
        row.appendChild(label);

        container.appendChild(row);
      });

      return container;
    };

    legendControl.addTo(window.trailMap);
  }

  function plotSegments(segments, legendItems) {
    if (!Array.isArray(segments)) {
      renderLegend(legendItems || []);
      return;
    }

    const visibleSegments = segments.filter((seg) => seg?.isPublic !== false);

    visibleSegments.forEach((segment) => {
      const style = segment.style || {};
      const accent = style.color || "#2563eb";

      const layer = L.geoJSON(segment.geojson, {
        style: () => ({
          color: accent,
          weight: style.weight || 5,
          dashArray: style.dashArray || null,
          lineCap: "round",
          lineJoin: "round",
          opacity: 0.9,
        }),
      });

      const popup = createSegmentPopup(segment, accent);
      layer.eachLayer((child) => {
        child.bindPopup(popup, { className: "segment-popup-container" });
      });

      layer.addTo(window.trailMap);
      state.bounds.extend(layer.getBounds());
    });

    const statusLegend = new Map();

    visibleSegments.forEach((seg) => {
      const statusKey = normalizeStatus(seg.status);
      if (!statusKey || statusLegend.has(statusKey)) return;

      const style = seg.style || {};
      statusLegend.set(statusKey, {
        label:
          seg.statusLabel ||
          config.statusLabels?.[statusKey] ||
          seg.legendLabel ||
          statusKey,
        color: style.color || "#2563eb",
        dashArray: style.dashArray || null,
      });
    });

    if (Array.isArray(legendItems) && legendItems.length) {
      legendItems.forEach((item) => {
        const key = normalizeStatus(item.status || item.id || item.label);
        if (!key || statusLegend.has(key)) return;
        statusLegend.set(key, {
          label: item.label || config.statusLabels?.[key] || key,
          color: item.color || "#2563eb",
          dashArray: item.dashArray || null,
        });
      });
    }

    const legendPayload = STATUS_ORDER.filter((key) =>
      statusLegend.has(key)
    ).map((key) => statusLegend.get(key));

    renderLegend(legendPayload);
  }

  /* ===== Data Loading ===== */
  async function bootstrap() {
    try {
      const apiBase = window.PUBLIC_CONFIG?.API_BASE || "";
      const apiRoot = apiBase.endsWith("/api") ? apiBase : `${apiBase}/api`;

      const [trailsRes, poisRes] = await Promise.all([
        fetch(`${apiRoot}/public/trails`),
        fetch(`${apiRoot}/public/pois`),
      ]);

      if (!trailsRes.ok || !poisRes.ok) {
        throw new Error("Failed to load map data");
      }

      const trails = await trailsRes.json();
      const poiPayload = await poisRes.json();

      setupCategories(poiPayload.categories || []);
      plotPois(poiPayload.pois || []);
      plotSegments(trails.segments || [], trails.legend || []);

      elements.filtersStatus.textContent =
        "Use toggles to show or hide activities and facilities.";

      if (state.bounds.isValid()) {
        window.trailMap.fitBounds(state.bounds, {
          padding: [32, 32],
          maxZoom: 14,
        });
      }
    } catch (error) {
      console.error("Map bootstrap error:", error);
      elements.filtersStatus.textContent =
        "We could not load map data right now. Please try again later.";
      elements.filtersStatus.classList.add("text-danger");
    } finally {
      refreshToggleAllLabel();
    }
  }

  /* ===== Event Listeners ===== */
  function initializeEventListeners() {
    // Toggle all categories
    elements.toggleAll?.addEventListener("click", () => {
      const ids = Object.keys(state.categoryState);
      if (!ids.length) return;

      const allOn = ids.every((id) => state.categoryState[id]);
      const nextValue = !allOn;

      ids.forEach((id) => {
        state.categoryState[id] = nextValue;
        const checkbox = state.checkboxMap.get(id);
        if (checkbox) checkbox.checked = nextValue;
        updateCategoryVisibility(id);
      });

      refreshToggleAllLabel();
    });

    // Mobile overlay toggle
    elements.toggleBtn?.addEventListener("click", () => {
      if (!mobileMq.matches) return;
      setOverlayState(!state.overlayIsOpen);
    });

    elements.closeBtn?.addEventListener("click", () => {
      setOverlayState(false);
      if (mobileMq.matches) elements.toggleBtn?.focus();
    });

    // ESC key to close overlay
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.overlayIsOpen && mobileMq.matches) {
        setOverlayState(false);
        elements.toggleBtn?.focus();
      }
    });

    // Responsive overlay sync
    syncOverlayToViewport(mobileMq);
    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", syncOverlayToViewport);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(syncOverlayToViewport);
    }
  }

  /* ===== Map Initialization ===== */
  function initializeMap() {
    window.trailMap = L.map("map", {
      center: [-43.75, 172.33],
      zoom: 11,
      zoomControl: false,
    });

    const tileLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }
    );

    tileLayer.addTo(window.trailMap);
    tileLayer.on("load", () => elements.loader?.classList.add("is-hidden"));

    L.control.zoom({ position: "bottomright" }).addTo(window.trailMap);
  }

  /* ===== Initialize ===== */
  function init() {
    initializeMap();
    initializeEventListeners();
    bootstrap();
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
