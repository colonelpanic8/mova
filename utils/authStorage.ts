import { deleteSecret, getSecret, setSecret } from "@/utils/secretStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTH_STORAGE_KEYS = {
  API_URL: "mova_api_url",
  USERNAME: "mova_username",
  PASSWORD: "mova_password",
} as const;

export async function getStoredCredentials(): Promise<{
  apiUrl: string | null;
  username: string | null;
  password: string | null;
}> {
  // Prefer secure store, but migrate from AsyncStorage if needed.
  const [apiUrl, username, password] = await Promise.all([
    getSecret(AUTH_STORAGE_KEYS.API_URL),
    getSecret(AUTH_STORAGE_KEYS.USERNAME),
    getSecret(AUTH_STORAGE_KEYS.PASSWORD),
  ]);

  if (apiUrl && username && password) {
    return { apiUrl, username, password };
  }

  const [legacyApiUrl, legacyUsername, legacyPassword] = await Promise.all([
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.API_URL),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.USERNAME),
    AsyncStorage.getItem(AUTH_STORAGE_KEYS.PASSWORD),
  ]);

  if (legacyApiUrl && legacyUsername && legacyPassword) {
    await Promise.all([
      setSecret(AUTH_STORAGE_KEYS.API_URL, legacyApiUrl),
      setSecret(AUTH_STORAGE_KEYS.USERNAME, legacyUsername),
      setSecret(AUTH_STORAGE_KEYS.PASSWORD, legacyPassword),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.API_URL),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USERNAME),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.PASSWORD),
    ]);
    return {
      apiUrl: legacyApiUrl,
      username: legacyUsername,
      password: legacyPassword,
    };
  }

  return { apiUrl: null, username: null, password: null };
}

export async function storeCredentials(input: {
  apiUrl: string;
  username: string;
  password: string;
}) {
  await Promise.all([
    setSecret(AUTH_STORAGE_KEYS.API_URL, input.apiUrl),
    setSecret(AUTH_STORAGE_KEYS.USERNAME, input.username),
    setSecret(AUTH_STORAGE_KEYS.PASSWORD, input.password),
    // Best-effort cleanup of legacy keys.
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.API_URL),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USERNAME),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.PASSWORD),
  ]);
}

export async function clearStoredCredentials() {
  await Promise.all([
    deleteSecret(AUTH_STORAGE_KEYS.API_URL),
    deleteSecret(AUTH_STORAGE_KEYS.USERNAME),
    deleteSecret(AUTH_STORAGE_KEYS.PASSWORD),
    // Best-effort cleanup of legacy keys.
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.API_URL),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USERNAME),
    AsyncStorage.removeItem(AUTH_STORAGE_KEYS.PASSWORD),
  ]);
}
