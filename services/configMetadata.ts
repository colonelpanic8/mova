import { normalizeUrl } from "@/utils/url";

export const CONFIG_HASH_HEADER = "x-org-agenda-config-hash";
export const CONFIG_METADATA_TTL_MS = 30 * 60 * 1000;

type ConfigHashListener = (event: {
  identityKey: string;
  configHash: string;
}) => void;

const configHashListeners = new Set<ConfigHashListener>();
const observedConfigHashes = new Map<string, string>();

export function buildConfigIdentityKey(
  apiUrl: string,
  username: string,
): string {
  return `${normalizeUrl(apiUrl)}::${username}`;
}

export function observeConfigHash(
  identityKey: string,
  configHash: string | null | undefined,
): void {
  const nextHash = configHash?.trim();
  if (!nextHash) {
    return;
  }

  if (observedConfigHashes.get(identityKey) === nextHash) {
    return;
  }

  observedConfigHashes.set(identityKey, nextHash);
  configHashListeners.forEach((listener) =>
    listener({ identityKey, configHash: nextHash }),
  );
}

export function getObservedConfigHash(identityKey: string): string | null {
  return observedConfigHashes.get(identityKey) ?? null;
}

export function clearObservedConfigHash(identityKey?: string): void {
  if (identityKey) {
    observedConfigHashes.delete(identityKey);
    return;
  }

  observedConfigHashes.clear();
}

export function subscribeToConfigHash(
  listener: ConfigHashListener,
): () => void {
  configHashListeners.add(listener);
  return () => {
    configHashListeners.delete(listener);
  };
}
