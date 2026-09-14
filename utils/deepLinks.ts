export interface ParsedDeepLink {
  action: string;
  params: Record<string, string>;
}

const LINK_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i;

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Parses `scheme://action?key=value` links without relying on the runtime's
 * URL implementation, which does not understand custom schemes on React
 * Native. Query values are form-decoded (`+` is a space); repeated keys keep
 * the first value.
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  const match = LINK_PATTERN.exec(url);
  if (!match) return null;
  const [, host, path, query = ""] = match;
  const pathAction = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const params: Record<string, string> = {};

  for (const pair of query.split("&")) {
    if (!pair) continue;
    const separator = pair.indexOf("=");
    const key = decode(separator === -1 ? pair : pair.slice(0, separator));
    const value = separator === -1 ? "" : decode(pair.slice(separator + 1));
    if (!(key in params)) params[key] = value;
  }

  return { action: pathAction || decode(host), params };
}
