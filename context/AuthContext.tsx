import { SavedServer, SavedServerInput } from "@/types/server";
import {
  clearStoredCredentials,
  getStoredCredentials,
  storeCredentials,
} from "@/utils/authStorage";
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
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { NativeModules, Platform } from "react-native";
import { useMutation } from "./MutationContext";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { triggerRefresh } = useMutation();
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
        setState({
          apiUrl: testArgs.apiUrl,
          username: testArgs.username,
          password: testArgs.password,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      const { apiUrl, username, password } = await getStoredCredentials();

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
    // Abort the credential test if the server never responds so login can't
    // hang forever. 15s matches the OrgAgendaApi default timeout. The timer
    // guards ONLY the fetch below — the post-fetch credential/storage work is
    // not subject to it, so a slow (but responsive) server can't cause an
    // unrelated post-fetch error to be misreported as a connection failure.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let normalizedUrl: string;
    let response: Response;
    try {
      normalizedUrl = normalizeUrl(apiUrl);
      // Test the credentials by hitting the /capture-templates endpoint
      response = await fetch(`${normalizedUrl}/capture-templates`, {
        headers: {
          Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      // Only the fetch is guarded by the abort timer, so an abort caught here
      // unambiguously means the request itself timed out.
      if (controller.signal.aborted) {
        // Surface timeouts distinctly so the login screen shows the
        // connection-failure copy rather than "invalid credentials".
        console.error("Login timed out after 15s");
        throw new Error("Connection failed. Check the URL and try again.");
      }
      console.error("Login failed:", error);
      return false;
    } finally {
      // Clear as soon as the fetch settles so the timer can't fire during the
      // post-fetch work below and flip controller.signal.aborted after the
      // fact. The finally acts as a safety net for both the resolve and throw
      // paths.
      clearTimeout(timeoutId);
    }

    try {
      if (response.ok) {
        await storeCredentials({ apiUrl: normalizedUrl, username, password });

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
            // Always keep the stored password up to date (secure store).
            await updateServerInStorage(existing.id, { password });
            await refreshSavedServers();
            await setActiveServerId(existing.id);
            setActiveServerIdState(existing.id);
          }
        }

        setState({
          apiUrl: normalizedUrl,
          username,
          password,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      }

      return false;
    } catch (error) {
      // Post-fetch failures are never timeouts, so they must not surface the
      // connection-failure copy.
      console.error("Login failed:", error);
      return false;
    }
  }

  async function logout() {
    await clearStoredCredentials();

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
      // Trigger a refresh of all screens to fetch data from the new server
      triggerRefresh();
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
