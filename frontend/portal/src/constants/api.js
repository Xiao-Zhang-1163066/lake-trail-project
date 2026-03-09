/**
 * API base URL configuration
 *
 * Uses VITE_API_BASE_URL from environment variables if available,
 * otherwise defaults to "/api" for local development.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";
