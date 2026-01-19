import { useAuth } from "@/context/AuthContext";
import { api, FilterOptionsResponse, TemplatesResponse } from "@/services/api";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface TemplatesContextType {
  templates: TemplatesResponse | null;
  filterOptions: FilterOptionsResponse | null;
  isLoading: boolean;
  error: string | null;
  reloadTemplates: () => Promise<void>;
}

const TemplatesContext = createContext<TemplatesContextType | undefined>(
  undefined,
);

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [filterOptions, setFilterOptions] =
    useState<FilterOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiUrl, username, password, isAuthenticated } = useAuth();

  const reloadTemplates = useCallback(async () => {
    if (!apiUrl || !username || !password) {
      return;
    }

    setIsLoading(true);
    setError(null);

    api.configure(apiUrl, username, password);

    // Fetch templates and filter options independently so one failure doesn't block the other
    const templatesPromise = api.getTemplates().then(
      (data) => {
        setTemplates(data);
        return true;
      },
      (err) => {
        console.error("Failed to load templates:", err);
        setError(err instanceof Error ? err.message : "Failed to load templates");
        return false;
      }
    );

    const filterOptionsPromise = api.getFilterOptions().then(
      (data) => {
        setFilterOptions(data);
      },
      () => {
        // Filter options are optional - silently ignore failures
      }
    );

    await Promise.all([templatesPromise, filterOptionsPromise]);
    setIsLoading(false);
  }, [apiUrl, username, password]);

  useEffect(() => {
    if (isAuthenticated) {
      reloadTemplates();
    } else {
      // Clear templates when logged out
      setTemplates(null);
      setFilterOptions(null);
    }
  }, [isAuthenticated, reloadTemplates]);

  return (
    <TemplatesContext.Provider
      value={{ templates, filterOptions, isLoading, error, reloadTemplates }}
    >
      {children}
    </TemplatesContext.Provider>
  );
}

export function useTemplates(): TemplatesContextType {
  const context = useContext(TemplatesContext);
  if (context === undefined) {
    throw new Error("useTemplates must be used within a TemplatesProvider");
  }
  return context;
}
