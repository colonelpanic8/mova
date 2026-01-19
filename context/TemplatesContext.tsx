import { useAuth } from "@/context/AuthContext";
import { api, CustomViewsResponse, FilterOptionsResponse, MetadataResponse, TemplatesResponse, TodoStatesResponse } from "@/services/api";
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
  todoStates: TodoStatesResponse | null;
  customViews: CustomViewsResponse | null;
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
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const [customViews, setCustomViews] = useState<CustomViewsResponse | null>(null);
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

    try {
      const metadata = await api.getMetadata();

      // Log any errors from the backend
      if (metadata.errors && metadata.errors.length > 0) {
        console.warn("Metadata fetch had errors:", metadata.errors);
      }

      setTemplates(metadata.templates);
      setFilterOptions(metadata.filterOptions);
      setTodoStates(metadata.todoStates);
      setCustomViews(metadata.customViews);

      // Set error if templates failed (critical)
      if (!metadata.templates) {
        setError("Failed to load templates");
      }
    } catch (err) {
      console.error("Failed to load metadata:", err);
      setError(err instanceof Error ? err.message : "Failed to load metadata");
    }

    setIsLoading(false);
  }, [apiUrl, username, password]);

  useEffect(() => {
    if (isAuthenticated) {
      reloadTemplates();
    } else {
      // Clear all state when logged out
      setTemplates(null);
      setFilterOptions(null);
      setTodoStates(null);
      setCustomViews(null);
    }
  }, [isAuthenticated, reloadTemplates]);

  return (
    <TemplatesContext.Provider
      value={{ templates, filterOptions, todoStates, customViews, isLoading, error, reloadTemplates }}
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
