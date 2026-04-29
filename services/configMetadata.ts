import type { MetadataResponse } from "@/services/api";
import { normalizeUrl } from "@/utils/url";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "mova_metadata_cache_v1";

export const CONFIG_HASH_HEADER = "x-org-agenda-config-hash";
export const CONFIG_METADATA_TTL_MS = 30 * 60 * 1000;

type ConfigHashListener = (event: {
  identityKey: string;
  configHash: string;
}) => void;

export interface CachedMetadataEntry {
  metadata: MetadataResponse;
  configHash: string | null;
  cachedAt: string;
}

const configHashListeners = new Set<ConfigHashListener>();
const observedConfigHashes = new Map<string, string>();

export function buildConfigIdentityKey(
  apiUrl: string,
  username: string,
): string {
  return `${normalizeUrl(apiUrl)}::${username}`;
}

function buildMetadataStorageKey(apiUrl: string, username: string): string {
  return `${STORAGE_PREFIX}:${buildConfigIdentityKey(apiUrl, username)}`;
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

export function isCachedMetadataFresh(
  cachedAt: string,
  now: number = Date.now(),
): boolean {
  const cachedTime = Date.parse(cachedAt);
  return (
    Number.isFinite(cachedTime) && now - cachedTime < CONFIG_METADATA_TTL_MS
  );
}

export async function getCachedMetadata(
  apiUrl: string,
  username: string,
): Promise<CachedMetadataEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(
      buildMetadataStorageKey(apiUrl, username),
    );
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedMetadataEntry>;
    if (!parsed.metadata || typeof parsed.cachedAt !== "string") {
      return null;
    }

    return {
      metadata: parsed.metadata,
      configHash: parsed.configHash ?? null,
      cachedAt: parsed.cachedAt,
    };
  } catch (error) {
    console.warn("Failed to read cached metadata:", error);
    return null;
  }
}

export async function saveCachedMetadata(
  apiUrl: string,
  username: string,
  entry: CachedMetadataEntry,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      buildMetadataStorageKey(apiUrl, username),
      JSON.stringify(entry),
    );
  } catch (error) {
    console.warn("Failed to save cached metadata:", error);
  }
}
