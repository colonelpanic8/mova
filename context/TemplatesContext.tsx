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
      console.log("[TemplatesContext] Not loading - missing credentials");
      return;
    }

    console.log("[TemplatesContext] Loading templates...");
    setIsLoading(true);
    setError(null);

    try {
      api.configure(apiUrl, username, password);
      const [templatesData, optionsData] = await Promise.all([
        api.getTemplates(),
        api.getFilterOptions(),
      ]);
      console.log("[TemplatesContext] Loaded successfully", {
        templateCount: Object.keys(templatesData).length,
      });
      setTemplates(templatesData);
      setFilterOptions(optionsData);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load templates";
      console.error("[TemplatesContext] Failed to load templates:", err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
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
