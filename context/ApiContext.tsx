import { useAuth } from "@/context/AuthContext";
import { ApiError, createApiClient, OrgAgendaApi } from "@/services/api";
import {
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
  const verifyingRef = useRef(false);

  // Keep logout ref up to date
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const apiClient = useMemo(() => {
    if (!apiUrl || !username || !password) {
      return null;
    }
    // A single 401 can be transient (e.g. the server restarting behind its
    // proxy). Before wiping auth state, re-verify the credentials with a
    // lightweight probe and only log out if that also comes back 401.
    const probeClient = createApiClient(apiUrl, username, password);
    return createApiClient(apiUrl, username, password, {
      onUnauthorized: () => {
        if (verifyingRef.current) return;
        verifyingRef.current = true;
        probeClient
          .getVersion()
          .then(() => {
            // Credentials still work; treat the 401 as transient.
          })
          .catch((error) => {
            if (error instanceof ApiError && error.status === 401) {
              logoutRef.current();
            }
          })
          .finally(() => {
            verifyingRef.current = false;
          });
      },
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
