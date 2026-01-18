/**
 * Normalize a URL by removing trailing slashes
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}
