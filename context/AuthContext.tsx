import { api } from "@/services/api";
import { SavedServer, SavedServerInput } from "@/types/server";
import { base64Encode } from "@/utils/base64";
import {
  deleteServer as deleteServerFromStorage,
  findServerById,
  getActiveServerId,
  getSavedServers,
  saveServer as saveServerToStorage,
  setActiveServerId,
  updateServer as updateServerInStorage,
} from "@/utils/serverStorage";
import { normalizeUrl } from "@/utils/url";
import {
  clearWidgetCredentials,
  saveCredentialsToWidget,
} from "@/widgets/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { NativeModules, Platform } from "react-native";

interface AuthState {
  apiUrl: string | null;
  username: string | null;
  password: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Get launch arguments for test auto-login (async)
async function getTestLaunchArgs(): Promise<{
  apiUrl?: string;
  username?: string;
  password?: string;
} | null> {
  try {
    if (Platform.OS === "android" && NativeModules.DetoxTestingArgs) {
      const launchArgs = await NativeModules.DetoxTestingArgs.getLaunchArgs();
      if (
        launchArgs?.detoxTestApiUrl &&
        launchArgs?.detoxTestUsername &&
        launchArgs?.detoxTestPassword
      ) {
        return {
          apiUrl: launchArgs.detoxTestApiUrl,
          username: launchArgs.detoxTestUsername,
          password: launchArgs.detoxTestPassword,
        };
      }
    }
  } catch {
    // Not in test mode
  }
  return null;
}

interface AuthContextType extends AuthState {
  login: (
    apiUrl: string,
    username: string,
    password: string,
    save?: boolean,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  getAuthHeader: () => string | null;
  // Multi-server methods
  savedServers: SavedServer[];
  activeServerId: string | null;
  switchServer: (serverId: string) => Promise<boolean>;
  saveCurrentServer: (nickname?: string) => Promise<SavedServer | null>;
  updateServer: (
    id: string,
    updates: Partial<SavedServerInput>,
  ) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  refreshSavedServers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  API_URL: "mova_api_url",
  USERNAME: "mova_username",
  PASSWORD: "mova_password",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    apiUrl: null,
    username: null,
    password: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);
  const [activeServerId, setActiveServerIdState] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadStoredCredentials();
  }, []);

  // Register logout callback with API to handle 401 responses
  useEffect(() => {
    api.setOnUnauthorized(() => {
      console.log("[AuthContext] Received unauthorized callback, logging out");
      logout();
    });
  }, []);

  async function refreshSavedServers() {
    const servers = await getSavedServers();
    setSavedServers(servers);
  }

  async function loadStoredCredentials() {
    try {
      // Load saved servers
      const servers = await getSavedServers();
      setSavedServers(servers);

      const storedActiveId = await getActiveServerId();
      setActiveServerIdState(storedActiveId);

      // Check for test launch args first (for Detox auto-login)
      const testArgs = await getTestLaunchArgs();
      if (testArgs?.apiUrl && testArgs?.username && testArgs?.password) {
        console.log("Auto-login with test launch args");
        setState({
          apiUrl: testArgs.apiUrl,
          username: testArgs.username,
          password: testArgs.password,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      const [apiUrl, username, password] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.API_URL),
        AsyncStorage.getItem(STORAGE_KEYS.USERNAME),
        AsyncStorage.getItem(STORAGE_KEYS.PASSWORD),
      ]);

      if (apiUrl && username && password) {
        setState({
          apiUrl,
          username,
          password,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error("Failed to load credentials:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }

  async function login(
    apiUrl: string,
    username: string,
    password: string,
    save: boolean = true,
  ): Promise<boolean> {
    try {
      const normalizedUrl = normalizeUrl(apiUrl);
      // Test the credentials by hitting the /templates endpoint
      const response = await fetch(`${normalizedUrl}/templates`, {
        headers: {
          Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
        },
      });

      if (response.ok) {
        console.log("[AuthContext] Login successful, saving credentials...");
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.API_URL, normalizedUrl),
          AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username),
          AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password),
        ]);

        // Also save to SharedPreferences for widget access
        await saveCredentialsToWidget(normalizedUrl, username, password);

        // Save to server list if requested
        if (save) {
          // Check if server already exists
          const currentServers = await getSavedServers();
          const existing = currentServers.find(
            (s) => s.apiUrl === normalizedUrl && s.username === username,
          );
          if (!existing) {
            const newServer = await saveServerToStorage({
              apiUrl: normalizedUrl,
              username,
              password,
            });
            await setActiveServerId(newServer.id);
            setActiveServerIdState(newServer.id);
            await refreshSavedServers();
          } else {
            // Update password if changed
            if (existing.password !== password) {
              await updateServerInStorage(existing.id, { password });
              await refreshSavedServers();
            }
            await setActiveServerId(existing.id);
            setActiveServerIdState(existing.id);
          }
        }

        console.log("[AuthContext] Credentials saved, updating state...");
        setState({
          apiUrl: normalizedUrl,
          username,
          password,
          isAuthenticated: true,
          isLoading: false,
        });
        console.log("[AuthContext] State updated, isAuthenticated=true");

        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }

  async function logout() {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.API_URL),
      AsyncStorage.removeItem(STORAGE_KEYS.USERNAME),
      AsyncStorage.removeItem(STORAGE_KEYS.PASSWORD),
    ]);

    // Also clear widget credentials
    await clearWidgetCredentials();

    // Clear active server id but keep saved servers
    await setActiveServerId(null);
    setActiveServerIdState(null);

    setState({
      apiUrl: null,
      username: null,
      password: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }

  async function switchServer(serverId: string): Promise<boolean> {
    const server = await findServerById(serverId);
    if (!server) return false;

    const success = await login(
      server.apiUrl,
      server.username,
      server.password,
      false,
    );
    if (success) {
      await setActiveServerId(serverId);
      setActiveServerIdState(serverId);
    }
    return success;
  }

  async function saveCurrentServer(
    nickname?: string,
  ): Promise<SavedServer | null> {
    if (!state.apiUrl || !state.username || !state.password) return null;

    const newServer = await saveServerToStorage({
      nickname,
      apiUrl: state.apiUrl,
      username: state.username,
      password: state.password,
    });

    await setActiveServerId(newServer.id);
    setActiveServerIdState(newServer.id);
    await refreshSavedServers();
    return newServer;
  }

  async function handleUpdateServer(
    id: string,
    updates: Partial<SavedServerInput>,
  ): Promise<void> {
    await updateServerInStorage(id, updates);
    await refreshSavedServers();

    // If updating the active server, update current credentials too
    if (id === activeServerId && state.isAuthenticated) {
      const updated = await findServerById(id);
      if (updated) {
        setState((prev) => ({
          ...prev,
          apiUrl: updated.apiUrl,
          username: updated.username,
          password: updated.password,
        }));
      }
    }
  }

  async function handleDeleteServer(id: string): Promise<void> {
    await deleteServerFromStorage(id);
    await refreshSavedServers();

    // If deleting the active server, clear active server id
    if (id === activeServerId) {
      await setActiveServerId(null);
      setActiveServerIdState(null);
    }
  }

  function getAuthHeader(): string | null {
    if (state.username && state.password) {
      return `Basic ${base64Encode(`${state.username}:${state.password}`)}`;
    }
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        getAuthHeader,
        savedServers,
        activeServerId,
        switchServer,
        saveCurrentServer,
        updateServer: handleUpdateServer,
        deleteServer: handleDeleteServer,
        refreshSavedServers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
