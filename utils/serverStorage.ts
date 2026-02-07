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

const SERVER_PASSWORD_PREFIX = "mova_server_password:";

function passwordKey(id: string) {
  return `${SERVER_PASSWORD_PREFIX}${id}`;
}

async function getServerPassword(id: string): Promise<string | null> {
  return await getSecret(passwordKey(id));
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

export async function getSavedServers(): Promise<SavedServer[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SERVERS);
    const parsed: any[] = stored ? JSON.parse(stored) : [];

    // Migrate legacy stored passwords into secure store, and remove from AsyncStorage.
    let didMigrate = false;
    const sanitized = await Promise.all(
      parsed.map(async (s) => {
        if (typeof s?.id !== "string") return s;
        if (typeof s?.password === "string" && s.password.length > 0) {
          await setServerPassword(s.id, s.password);
          const { password, ...rest } = s;
          didMigrate = true;
          return rest;
        }
        return s;
      }),
    );

    if (didMigrate) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SAVED_SERVERS,
        JSON.stringify(sanitized),
      );
    }

    const withFlags: SavedServer[] = await Promise.all(
      sanitized.map(async (s) => {
        if (!s?.id) return s;
        const pw = await getServerPassword(s.id);
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
  if (index !== -1) {
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
