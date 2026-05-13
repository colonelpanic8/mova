import AsyncStorage from "@react-native-async-storage/async-storage";

// Thin wrapper around secure storage with a web fallback.
// On web, AsyncStorage is used (best-effort; not truly secure).

async function isWeb(): Promise<boolean> {
  // Avoid importing react-native in unit test (node) environment.
  // If react-native isn't available/parsable, fall back to web behavior.
  try {
    const { Platform } = await import("react-native");
    return Platform.OS === "web";
  } catch {
    return true;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  if (await isWeb()) {
    return await AsyncStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return await SecureStore.getItemAsync(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (await isWeb()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  if (await isWeb()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(key);
}
