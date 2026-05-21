const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export function createApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, apiBaseUrl);
}
