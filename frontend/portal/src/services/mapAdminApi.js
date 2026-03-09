const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

const authHeaders = (token, withJson = false) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-Portal-Authorization": `Bearer ${token}`,
    "X-Auth-Token": token,
  };

  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const ensureOk = async (response, onUnauthorized) => {
  if (response.ok) return;

  if (response.status === 401) {
    onUnauthorized?.();
    throw new Error("UNAUTHORIZED");
  }

  const errorText = await response.text();
  throw new Error(errorText || `HTTP ${response.status}`);
};

export const fetchPublicMapData = async () => {
  const [poisRes, trailsRes] = await Promise.all([
    fetch(`${API_BASE}/public/pois`),
    fetch(`${API_BASE}/public/trails`),
  ]);

  await ensureOk(poisRes);
  await ensureOk(trailsRes);

  return {
    poisData: await poisRes.json(),
    trailsData: await trailsRes.json(),
  };
};

export const upsertTrail = async ({
  token,
  payload,
  trailId,
  onUnauthorized,
}) => {
  const isUpdating = Boolean(trailId);
  const endpoint = isUpdating
    ? `${API_BASE}/map/admin/trails/${trailId}`
    : `${API_BASE}/map/admin/trails`;
  const method = isUpdating ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  await ensureOk(response, onUnauthorized);
  return response.json();
};

export const upsertPoi = async ({ token, payload, poiId, onUnauthorized }) => {
  const isUpdating = Boolean(poiId);
  const endpoint = isUpdating
    ? `${API_BASE}/map/admin/pois/${poiId}`
    : `${API_BASE}/map/admin/pois`;
  const method = isUpdating ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  await ensureOk(response, onUnauthorized);
  return response.json();
};

export const removeTrail = async ({ token, trailId, onUnauthorized }) => {
  const response = await fetch(`${API_BASE}/map/admin/trails/${trailId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  await ensureOk(response, onUnauthorized);
};

export const removePoi = async ({ token, poiId, onUnauthorized }) => {
  const response = await fetch(`${API_BASE}/map/admin/pois/${poiId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  await ensureOk(response, onUnauthorized);
};

