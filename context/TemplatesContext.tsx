import { useAuth } from "@/context/AuthContext";
import {
  api,
  CategoryType,
  CustomViewsResponse,
  FilterOptionsResponse,
  HabitConfig,
  TemplatesResponse,
  TodoStatesResponse,
} from "@/services/api";
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
  categoryTypes: CategoryType[] | null;
  filterOptions: FilterOptionsResponse | null;
  todoStates: TodoStatesResponse | null;
  customViews: CustomViewsResponse | null;
  habitConfig: HabitConfig | null;
  isLoading: boolean;
  error: string | null;
  reloadTemplates: () => Promise<void>;
}

const TemplatesContext = createContext<TemplatesContextType | undefined>(
  undefined,
);

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[] | null>(
    null,
  );
  const [filterOptions, setFilterOptions] =
    useState<FilterOptionsResponse | null>(null);
  const [todoStates, setTodoStates] = useState<TodoStatesResponse | null>(null);
  const [customViews, setCustomViews] = useState<CustomViewsResponse | null>(
    null,
  );
  const [habitConfig, setHabitConfig] = useState<HabitConfig | null>(null);
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
      // Use the unified /metadata endpoint for all app metadata
      const metadata = await api.getMetadata();

      // Log any errors from the backend
      if (metadata.errors && metadata.errors.length > 0) {
        console.warn("Metadata fetch had errors:", metadata.errors);
      }

      setTemplates(metadata.templates);
      setFilterOptions(metadata.filterOptions);
      setTodoStates(metadata.todoStates);
      setCustomViews(metadata.customViews);
      setCategoryTypes(metadata.categoryTypes?.types ?? null);
      setHabitConfig(metadata.habitConfig);

      // Set error if templates failed (critical)
      if (!metadata.templates) {
        setError("Failed to load templates");
      }
    } catch (err) {
      // Fallback to individual endpoints if /metadata is not available
      console.warn(
        "Metadata endpoint failed, falling back to individual endpoints:",
        err,
      );

      const results = await Promise.allSettled([
        api.getTemplates(),
        api.getFilterOptions(),
        api.getTodoStates(),
        api.getCustomViews(),
        api.getCategoryTypes(),
        api.getHabitConfig(),
      ]);

      const [
        templatesResult,
        filterOptionsResult,
        todoStatesResult,
        customViewsResult,
        categoryTypesResult,
        habitConfigResult,
      ] = results;

      if (templatesResult.status === "fulfilled") {
        setTemplates(templatesResult.value);
      } else {
        console.error("Failed to load templates:", templatesResult.reason);
        setError("Failed to load templates");
      }

      if (filterOptionsResult.status === "fulfilled") {
        setFilterOptions(filterOptionsResult.value);
      }

      if (todoStatesResult.status === "fulfilled") {
        setTodoStates(todoStatesResult.value);
      }

      if (customViewsResult.status === "fulfilled") {
        setCustomViews(customViewsResult.value);
      }

      if (categoryTypesResult.status === "fulfilled") {
        setCategoryTypes(categoryTypesResult.value.types);
      } else {
        console.warn(
          "Failed to fetch category types:",
          categoryTypesResult.reason,
        );
        setCategoryTypes([]);
      }

      if (habitConfigResult.status === "fulfilled") {
        setHabitConfig(habitConfigResult.value);
      } else {
        console.warn("Failed to fetch habit config:", habitConfigResult.reason);
        setHabitConfig({ status: "ok", enabled: false });
      }
    }

    setIsLoading(false);
  }, [apiUrl, username, password]);

  useEffect(() => {
    if (isAuthenticated) {
      reloadTemplates();
    } else {
      // Clear all state when logged out
      setTemplates(null);
      setCategoryTypes(null);
      setFilterOptions(null);
      setTodoStates(null);
      setCustomViews(null);
      setHabitConfig(null);
    }
  }, [isAuthenticated, reloadTemplates]);

  return (
    <TemplatesContext.Provider
      value={{
        templates,
        categoryTypes,
        filterOptions,
        todoStates,
        customViews,
        habitConfig,
        isLoading,
        error,
        reloadTemplates,
      }}
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
