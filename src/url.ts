// Vite's `import.meta.env.BASE_URL` always ends with a trailing slash
// (e.g. `/` in dev, `/node-rpg/` when deployed to a subpath). Combined
// with our `${baseUrl()}/${path}` usage that would produce double
// slashes — works in browsers but pollutes console + network logs.
// Strip the trailing slash so callers can always write `${baseUrl()}/x`.
export function baseUrl(): string {
  return import.meta.env.BASE_URL.replace(/\/+$/, "");
}

// Convenience: join the base URL with a possibly-leading-slash path
// and return a clean absolute URL (no doubled slashes).
export function assetUrl(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  return `${baseUrl()}/${trimmed}`;
}
