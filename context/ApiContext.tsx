import { useAuth } from "@/context/AuthContext";
import { createApiClient, OrgAgendaApi } from "@/services/api";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

const ApiContext = createContext<OrgAgendaApi | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { apiUrl, username, password, logout } = useAuth();
  const logoutRef = useRef(logout);

  // Keep logout ref up to date
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const apiClient = useMemo(() => {
    if (!apiUrl || !username || !password) {
      return null;
    }
    return createApiClient(apiUrl, username, password, {
      onUnauthorized: () => logoutRef.current(),
    });
  }, [apiUrl, username, password]);

  return (
    <ApiContext.Provider value={apiClient}>{children}</ApiContext.Provider>
  );
}

/**
 * Hook to access the API client.
 * Returns null if not authenticated.
 */
export function useApi(): OrgAgendaApi | null {
  return useContext(ApiContext);
}

/**
 * Hook to access the API client, throwing if not authenticated.
 * Use this when you know the user must be authenticated.
 */
export function useApiRequired(): OrgAgendaApi {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error("useApiRequired called without authenticated API client");
  }
  return api;
}
