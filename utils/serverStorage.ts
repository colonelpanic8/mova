import {
  SavedServer,
  SavedServerInput,
  SavedServerWithPassword,
} from "@/types/server";
import { deleteSecret, getSecret, setSecret } from "@/utils/secretStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  SAVED_SERVERS: "mova_saved_servers",
  ACTIVE_SERVER_ID: "mova_active_server_id",
};

// Native SecureStore only accepts alphanumeric keys plus ".", "-", and "_".
// The legacy prefix used a colon, so every native secret write threw and, via
// getSavedServers's catch-all, made the whole saved-server list unreadable.
const SERVER_PASSWORD_PREFIX = "mova_server_password.";
const LEGACY_SERVER_PASSWORD_PREFIX = "mova_server_password:";

function passwordKey(id: string) {
  return `${SERVER_PASSWORD_PREFIX}${id}`;
}

async function getServerPassword(id: string): Promise<string | null> {
  const password = await getSecret(passwordKey(id));
  if (password !== null) {
    return password;
  }
  // Colon-prefixed keys could only ever be written on web (AsyncStorage
  // backend); migrate them. On native the read itself throws — nothing was
  // ever stored there.
  try {
    const legacy = await getSecret(`${LEGACY_SERVER_PASSWORD_PREFIX}${id}`);
    if (legacy !== null) {
      await setSecret(passwordKey(id), legacy);
      await deleteSecret(`${LEGACY_SERVER_PASSWORD_PREFIX}${id}`);
    }
    return legacy;
  } catch {
    return null;
  }
}

async function setServerPassword(id: string, password: string): Promise<void> {
  await setSecret(passwordKey(id), password);
}

async function deleteServerPassword(id: string): Promise<void> {
  await deleteSecret(passwordKey(id));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Shape of a server entry as persisted in AsyncStorage. Legacy entries may
 * still carry a plaintext password (migrated to the secure store on read).
 */
type StoredServer = Omit<SavedServer, "hasPassword"> & { password?: string };

function isStoredServer(value: unknown): value is StoredServer {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string";
}

export async function getSavedServers(): Promise<SavedServer[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SERVERS);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    // Drop malformed entries (no usable id) instead of passing them through.
    const entries = Array.isArray(parsed) ? parsed.filter(isStoredServer) : [];

    // Migrate legacy stored passwords into secure store, and remove from
    // AsyncStorage. A failed migration keeps that entry's plaintext password
    // in place so a later read can retry — it must never invalidate the list.
    let didMigrate = false;
    const persisted: StoredServer[] = [];
    for (const entry of entries) {
      let stored = entry;
      if (typeof entry.password === "string" && entry.password.length > 0) {
        try {
          await setServerPassword(entry.id, entry.password);
          didMigrate = true;
          const { password: _password, ...rest } = entry;
          stored = rest;
        } catch (error) {
          console.warn("Failed to migrate stored server password:", error);
        }
      }
      persisted.push(stored);
    }

    if (didMigrate) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SAVED_SERVERS,
        JSON.stringify(persisted),
      );
    }

    const withFlags: SavedServer[] = await Promise.all(
      persisted.map(async ({ password, ...s }) => {
        const pw = password ?? (await getServerPassword(s.id));
        return { ...s, hasPassword: !!pw };
      }),
    );

    return withFlags;
  } catch {
    return [];
  }
}

export async function saveServer(
  input: SavedServerInput,
): Promise<SavedServer> {
  const servers = await getSavedServers();
  const id = generateId();
  await setServerPassword(id, input.password);
  const { password: _password, ...rest } = input;
  const newServer: SavedServer = { ...rest, id, hasPassword: true };
  servers.push({ ...rest, id });
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_SERVERS,
    JSON.stringify(servers.map(({ hasPassword, ...s }) => s)),
  );
  return newServer;
}

export async function updateServer(
  id: string,
  updates: Partial<SavedServerInput>,
): Promise<void> {
  const servers = await getSavedServers();
  const index = servers.findIndex((s) => s.id === id);
  if (index === -1) {
    console.warn(`updateServer: no saved server with id ${id}; update dropped`);
    return;
  }
  if (typeof updates.password === "string") {
    await setServerPassword(id, updates.password);
  }
  const { password: _password, ...rest } = updates;
  servers[index] = { ...servers[index], ...rest };
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_SERVERS,
    JSON.stringify(servers.map(({ hasPassword, ...s }) => s)),
  );
}

export async function deleteServer(id: string): Promise<void> {
  const servers = await getSavedServers();
  const filtered = servers.filter((s) => s.id !== id);
  await deleteServerPassword(id);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_SERVERS,
    JSON.stringify(filtered.map(({ hasPassword, ...s }) => s)),
  );
}

export async function getActiveServerId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SERVER_ID);
}

export async function setActiveServerId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SERVER_ID, id);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVER_ID);
  }
}

export async function findServerById(
  id: string,
): Promise<SavedServerWithPassword | undefined> {
  const servers = await getSavedServers();
  const server = servers.find((s) => s.id === id);
  if (!server) return undefined;
  const password = await getServerPassword(id);
  if (!password) return undefined;
  return { ...server, password };
}
