import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, SIGNED_OUT_IDENTITY } from "@/hooks/queryKeys";
import {
  CategoryType,
  CustomViewsResponse,
  ExposedFunction,
  FilterOptionsResponse,
  HabitConfig,
  MetadataResponse,
  OrgAgendaApi,
  TemplatesResponse,
  TodoStatesResponse,
} from "@/services/api";
import {
  buildConfigIdentityKey,
  CONFIG_METADATA_TTL_MS,
  getObservedConfigHash,
  subscribeToConfigHash,
} from "@/services/configMetadata";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { AppState } from "react-native";

interface TemplatesContextType {
  templates: TemplatesResponse | null;
  categoryTypes: CategoryType[] | null;
  filterOptions: FilterOptionsResponse | null;
  todoStates: TodoStatesResponse | null;
  customViews: CustomViewsResponse | null;
  habitConfig: HabitConfig | null;
  exposedFunctions: ExposedFunction[] | null;
  isLoading: boolean;
  error: string | null;
  reloadTemplates: () => Promise<void>;
  ensureFreshTemplates: () => Promise<void>;
}

/**
 * What the metadata query stores: the merged metadata plus the config hash
 * observed when it was fetched, so hash changes seen on later API responses
 * can invalidate it.
 */
interface MetadataQueryData {
  metadata: MetadataResponse;
  configHash: string | null;
}

const EMPTY_METADATA: MetadataResponse = {
  templates: null,
  filterOptions: null,
  todoStates: null,
  customViews: null,
  categoryTypes: null,
  habitConfig: null,
  exposedFunctions: null,
  errors: [],
};

/**
 * Merge a fresh metadata response over the previous one, preserving previous
 * non-null sections when the new response is missing them (partial server
 * failures must not wipe known-good data).
 */
function mergeMetadata(
  previous: MetadataResponse | null,
  next: MetadataResponse,
): MetadataResponse {
  if (!previous) {
    return { ...next, errors: next.errors ?? [] };
  }
  return {
    templates: next.templates ?? previous.templates,
    filterOptions: next.filterOptions ?? previous.filterOptions,
    todoStates: next.todoStates ?? previous.todoStates,
    customViews: next.customViews ?? previous.customViews,
    categoryTypes: next.categoryTypes ?? previous.categoryTypes,
    habitConfig: next.habitConfig ?? previous.habitConfig,
    exposedFunctions: next.exposedFunctions ?? previous.exposedFunctions,
    errors: next.errors ?? [],
  };
}

/**
 * Fallback when the combined /metadata endpoint is unavailable (older
 * servers): fetch each section individually and tolerate partial failures.
 */
async function buildFallbackMetadata(
  api: OrgAgendaApi,
): Promise<MetadataResponse> {
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

  const errors: string[] = [];

  if (templatesResult.status === "rejected") {
    console.error("Failed to load templates:", templatesResult.reason);
    errors.push(`templates: ${String(templatesResult.reason)}`);
  }
  if (filterOptionsResult.status === "rejected") {
    console.warn("Failed to fetch filter options:", filterOptionsResult.reason);
    errors.push(`filterOptions: ${String(filterOptionsResult.reason)}`);
  }
  if (todoStatesResult.status === "rejected") {
    console.warn("Failed to fetch todo states:", todoStatesResult.reason);
    errors.push(`todoStates: ${String(todoStatesResult.reason)}`);
  }
  if (customViewsResult.status === "rejected") {
    console.warn("Failed to fetch custom views:", customViewsResult.reason);
    errors.push(`customViews: ${String(customViewsResult.reason)}`);
  }
  if (categoryTypesResult.status === "rejected") {
    console.warn("Failed to fetch category types:", categoryTypesResult.reason);
    errors.push(`categoryTypes: ${String(categoryTypesResult.reason)}`);
  }
  if (habitConfigResult.status === "rejected") {
    console.warn("Failed to fetch habit config:", habitConfigResult.reason);
    errors.push(`habitConfig: ${String(habitConfigResult.reason)}`);
  }

  return {
    templates:
      templatesResult.status === "fulfilled" ? templatesResult.value : null,
    filterOptions:
      filterOptionsResult.status === "fulfilled"
        ? filterOptionsResult.value
        : null,
    todoStates:
      todoStatesResult.status === "fulfilled" ? todoStatesResult.value : null,
    customViews:
      customViewsResult.status === "fulfilled" ? customViewsResult.value : null,
    categoryTypes:
      categoryTypesResult.status === "fulfilled"
        ? categoryTypesResult.value
        : null,
    habitConfig:
      habitConfigResult.status === "fulfilled" ? habitConfigResult.value : null,
    exposedFunctions: null,
    errors,
  };
}

const TemplatesContext = createContext<TemplatesContextType | undefined>(
  undefined,
);

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, apiUrl, username } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();

  const identityKey =
    apiUrl && username ? buildConfigIdentityKey(apiUrl, username) : null;
  const queryKey = useMemo(
    () => queryKeys.metadata(identityKey ?? SIGNED_OUT_IDENTITY),
    [identityKey],
  );

  const query = useQuery({
    queryKey,
    enabled: Boolean(isAuthenticated && api && identityKey),
    // Metadata changes rarely; refetches are driven by the config-hash
    // observer and the TTL check in ensureFreshTemplates.
    staleTime: CONFIG_METADATA_TTL_MS,
    queryFn: async (): Promise<MetadataQueryData> => {
      let metadata: MetadataResponse;
      try {
        metadata = await api!.getMetadata();
        if (metadata.errors && metadata.errors.length > 0) {
          console.warn("Metadata fetch had errors:", metadata.errors);
        }
      } catch (err) {
        console.warn(
          "Metadata endpoint failed, falling back to individual endpoints:",
          err,
        );
        metadata = await buildFallbackMetadata(api!);
      }

      const previous = queryClient.getQueryData<MetadataQueryData>(queryKey);
      return {
        metadata: mergeMetadata(previous?.metadata ?? null, metadata),
        configHash: getObservedConfigHash(identityKey!),
      };
    },
  });

  const { refetch } = query;

  const reloadTemplates = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const ensureFreshTemplates = useCallback(async () => {
    if (!api || !identityKey) {
      return;
    }
    if (queryClient.isFetching({ queryKey }) > 0) {
      return;
    }

    const current = queryClient.getQueryData<MetadataQueryData>(queryKey);
    const observedHash = getObservedConfigHash(identityKey);
    const configChanged = Boolean(
      observedHash && observedHash !== current?.configHash,
    );

    const dataUpdatedAt =
      queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
    const isStale = Date.now() - dataUpdatedAt >= CONFIG_METADATA_TTL_MS;

    if (configChanged || !current?.metadata.habitConfig || isStale) {
      await queryClient.invalidateQueries({ queryKey });
    }
  }, [api, identityKey, queryClient, queryKey]);

  // The server reports a config hash on every API response; when it changes,
  // the metadata this context serves is out of date — refetch in the
  // background.
  useEffect(() => {
    if (!identityKey) {
      return;
    }

    return subscribeToConfigHash((event) => {
      if (event.identityKey !== identityKey) {
        return;
      }
      if (queryClient.isFetching({ queryKey }) > 0) {
        return;
      }
      const current = queryClient.getQueryData<MetadataQueryData>(queryKey);
      if (event.configHash === current?.configHash) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey });
    });
  }, [identityKey, queryClient, queryKey]);

  // Revalidate when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void ensureFreshTemplates();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ensureFreshTemplates]);

  const metadata = query.data?.metadata ?? EMPTY_METADATA;
  const hasData = query.data !== undefined;

  const value = useMemo<TemplatesContextType>(
    () => ({
      templates: metadata.templates,
      categoryTypes: metadata.categoryTypes?.types ?? null,
      filterOptions: metadata.filterOptions,
      todoStates: metadata.todoStates,
      customViews: metadata.customViews,
      habitConfig: metadata.habitConfig,
      exposedFunctions: metadata.exposedFunctions,
      isLoading: isAuthenticated && query.isPending,
      error:
        hasData && !metadata.templates
          ? "Failed to load templates"
          : query.isError
            ? "Failed to load templates"
            : null,
      reloadTemplates,
      ensureFreshTemplates,
    }),
    [
      metadata,
      hasData,
      isAuthenticated,
      query.isPending,
      query.isError,
      reloadTemplates,
      ensureFreshTemplates,
    ],
  );

  return (
    <TemplatesContext.Provider value={value}>
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
