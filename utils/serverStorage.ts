import { SavedServer, SavedServerInput } from "@/types/server";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  SAVED_SERVERS: "mova_saved_servers",
  ACTIVE_SERVER_ID: "mova_active_server_id",
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function getSavedServers(): Promise<SavedServer[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SERVERS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveServer(
  input: SavedServerInput,
): Promise<SavedServer> {
  const servers = await getSavedServers();
  const newServer: SavedServer = { ...input, id: generateId() };
  servers.push(newServer);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_SERVERS,
    JSON.stringify(servers),
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
    servers[index] = { ...servers[index], ...updates };
    await AsyncStorage.setItem(
      STORAGE_KEYS.SAVED_SERVERS,
      JSON.stringify(servers),
    );
  }
}

export async function deleteServer(id: string): Promise<void> {
  const servers = await getSavedServers();
  const filtered = servers.filter((s) => s.id !== id);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_SERVERS,
    JSON.stringify(filtered),
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
): Promise<SavedServer | undefined> {
  const servers = await getSavedServers();
  return servers.find((s) => s.id === id);
}
