export const createMarkerIcon = (
  L,
  iconPath,
  accent,
  fallbackIconPath = "/assets/icons/categories/default.svg"
) => {
  const safeAccent = accent || "#1fa74d";
  const safeIconPath = iconPath || fallbackIconPath;

  return L.divIcon({
    html: `
      <div class="poi-marker-container" style="
        width: 44px;
        height: 44px;
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
          style="width: 24px; height: 24px;"
          onerror="this.src='${fallbackIconPath}'"
        />
      </div>
    `,
    className: "custom-div-icon",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

