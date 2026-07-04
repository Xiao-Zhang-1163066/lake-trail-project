(function () {
  // 如果在本地（用 file:// 或 localhost 打开），走本地 API
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const portalBase = isLocal ? "http://localhost:5173/portal" : "/portal";
  // 配置 API 基础路径
  window.PUBLIC_CONFIG = {
    API_BASE: isLocal
      ? "http://localhost:7071/api"
      : "https://te-waihora-api-dyaqdzbbcngqcbfz.australiasoutheast-01.azurewebsites.net/api",
    PORTAL_BASE: portalBase,
  };
})();
