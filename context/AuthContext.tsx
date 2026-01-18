import { api } from "@/services/api";
import { base64Encode } from "@/utils/base64";
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
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  getAuthHeader: () => string | null;
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

  async function loadStoredCredentials() {
    try {
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
  ): Promise<boolean> {
    try {
      // Test the credentials by hitting the /templates endpoint
      const response = await fetch(`${apiUrl}/templates`, {
        headers: {
          Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
        },
      });

      if (response.ok) {
        console.log("[AuthContext] Login successful, saving credentials...");
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.API_URL, apiUrl),
          AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username),
          AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password),
        ]);

        // Also save to SharedPreferences for widget access
        await saveCredentialsToWidget(apiUrl, username, password);

        console.log("[AuthContext] Credentials saved, updating state...");
        setState({
          apiUrl,
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

    setState({
      apiUrl: null,
      username: null,
      password: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }

  function getAuthHeader(): string | null {
    if (state.username && state.password) {
      return `Basic ${base64Encode(`${state.username}:${state.password}`)}`;
    }
    return null;
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getAuthHeader }}>
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
