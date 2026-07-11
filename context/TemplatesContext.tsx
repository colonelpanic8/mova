import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import {
  CategoryType,
  CustomViewsResponse,
  ExposedFunction,
  FilterOptionsResponse,
  HabitConfig,
  MetadataResponse,
  TemplatesResponse,
  TodoStatesResponse,
} from "@/services/api";
import {
  buildConfigIdentityKey,
  CONFIG_METADATA_TTL_MS,
  getCachedMetadata,
  getObservedConfigHash,
  isCachedMetadataFresh,
  saveCachedMetadata,
  subscribeToConfigHash,
} from "@/services/configMetadata";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
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

type InFlightMetadataRequest = {
  identityKey: string;
  promise: Promise<void>;
  token: object;
};

function metadataHasValues(metadata: MetadataResponse): boolean {
  return Boolean(
    metadata.templates ||
    metadata.filterOptions ||
    metadata.todoStates ||
    metadata.customViews ||
    metadata.categoryTypes ||
    metadata.habitConfig ||
    metadata.exposedFunctions,
  );
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
  const [exposedFunctions, setExposedFunctions] = useState<
    ExposedFunction[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadataRef = useRef<MetadataResponse>(EMPTY_METADATA);
  const lastLoadedAtRef = useRef<number | null>(null);
  const currentConfigHashRef = useRef<string | null>(null);
  const reloadPromiseRef = useRef<InFlightMetadataRequest | null>(null);
  const activeIdentityRef = useRef<string | null>(null);

  const { isAuthenticated, apiUrl, username } = useAuth();
  const api = useApi();
  const identityKey =
    apiUrl && username ? buildConfigIdentityKey(apiUrl, username) : null;

  const applyMetadata = useCallback(
    (
      metadata: MetadataResponse,
      options: { preserveExisting?: boolean } = {},
    ): MetadataResponse => {
      const preserveExisting = options.preserveExisting ?? true;
      const previous = metadataRef.current;
      const next: MetadataResponse = {
        templates: preserveExisting
          ? (metadata.templates ?? previous.templates)
          : metadata.templates,
        filterOptions: preserveExisting
          ? (metadata.filterOptions ?? previous.filterOptions)
          : metadata.filterOptions,
        todoStates: preserveExisting
          ? (metadata.todoStates ?? previous.todoStates)
          : metadata.todoStates,
        customViews: preserveExisting
          ? (metadata.customViews ?? previous.customViews)
          : metadata.customViews,
        categoryTypes: preserveExisting
          ? (metadata.categoryTypes ?? previous.categoryTypes)
          : metadata.categoryTypes,
        habitConfig: preserveExisting
          ? (metadata.habitConfig ?? previous.habitConfig)
          : metadata.habitConfig,
        exposedFunctions: preserveExisting
          ? (metadata.exposedFunctions ?? previous.exposedFunctions)
          : metadata.exposedFunctions,
        errors: metadata.errors ?? [],
      };

      metadataRef.current = next;
      setTemplates(next.templates);
      setFilterOptions(next.filterOptions);
      setTodoStates(next.todoStates);
      setCustomViews(next.customViews);
      setCategoryTypes(next.categoryTypes?.types ?? null);
      setHabitConfig(next.habitConfig);
      setExposedFunctions(next.exposedFunctions);
      setError(next.templates ? null : "Failed to load templates");

      return next;
    },
    [],
  );

  const buildFallbackMetadata =
    useCallback(async (): Promise<MetadataResponse> => {
      if (!api) {
        return EMPTY_METADATA;
      }

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
        console.warn(
          "Failed to fetch filter options:",
          filterOptionsResult.reason,
        );
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
        console.warn(
          "Failed to fetch category types:",
          categoryTypesResult.reason,
        );
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
          todoStatesResult.status === "fulfilled"
            ? todoStatesResult.value
            : null,
        customViews:
          customViewsResult.status === "fulfilled"
            ? customViewsResult.value
            : null,
        categoryTypes:
          categoryTypesResult.status === "fulfilled"
            ? categoryTypesResult.value
            : null,
        habitConfig:
          habitConfigResult.status === "fulfilled"
            ? habitConfigResult.value
            : null,
        exposedFunctions: null,
        errors,
      };
    }, [api]);

  const fetchTemplates = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!api || !identityKey) {
        return;
      }

      const requestIdentityKey = identityKey;
      const existingRequest = reloadPromiseRef.current;
      if (existingRequest?.identityKey === requestIdentityKey) {
        return existingRequest.promise;
      }

      const requestToken = {};
      const run = (async () => {
        if (!background) {
          setIsLoading(true);
        }
        setError(null);

        try {
          let metadata: MetadataResponse;

          try {
            metadata = await api.getMetadata();

            if (metadata.errors && metadata.errors.length > 0) {
              console.warn("Metadata fetch had errors:", metadata.errors);
            }
          } catch (err) {
            console.warn(
              "Metadata endpoint failed, falling back to individual endpoints:",
              err,
            );
            metadata = await buildFallbackMetadata();
          }

          if (
            activeIdentityRef.current !== requestIdentityKey ||
            reloadPromiseRef.current?.token !== requestToken
          ) {
            return;
          }

          const mergedMetadata = applyMetadata(metadata, {
            preserveExisting: true,
          });
          const now = new Date();
          const observedHash = getObservedConfigHash(requestIdentityKey);

          if (metadataHasValues(mergedMetadata)) {
            lastLoadedAtRef.current = now.getTime();
          }
          if (observedHash) {
            currentConfigHashRef.current = observedHash;
          }

          if (
            apiUrl &&
            username &&
            activeIdentityRef.current === requestIdentityKey &&
            metadataHasValues(mergedMetadata)
          ) {
            await saveCachedMetadata(apiUrl, username, {
              metadata: mergedMetadata,
              configHash: currentConfigHashRef.current,
              cachedAt: now.toISOString(),
            });
          }
        } finally {
          if (reloadPromiseRef.current?.token === requestToken) {
            setIsLoading(false);
            setHasLoadedOnce(true);
            reloadPromiseRef.current = null;
          }
        }
      })();

      reloadPromiseRef.current = {
        identityKey: requestIdentityKey,
        promise: run,
        token: requestToken,
      };
      return run;
    },
    [api, apiUrl, applyMetadata, buildFallbackMetadata, identityKey, username],
  );

  const reloadTemplates = useCallback(async () => {
    await fetchTemplates({ background: hasLoadedOnce });
  }, [fetchTemplates, hasLoadedOnce]);

  const ensureFreshTemplates = useCallback(async () => {
    if (!api) {
      return;
    }

    const observedHash = identityKey
      ? getObservedConfigHash(identityKey)
      : null;
    if (
      observedHash &&
      observedHash !== currentConfigHashRef.current &&
      !reloadPromiseRef.current
    ) {
      await fetchTemplates({ background: true });
      return;
    }

    const lastLoadedAt = lastLoadedAtRef.current;
    if (
      (!metadataRef.current.habitConfig ||
        !metadataHasValues(metadataRef.current) ||
        !lastLoadedAt ||
        Date.now() - lastLoadedAt >= CONFIG_METADATA_TTL_MS) &&
      !reloadPromiseRef.current
    ) {
      await fetchTemplates({ background: true });
    }
  }, [api, fetchTemplates, identityKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMetadata() {
      if (!isAuthenticated || !api || !apiUrl || !username) {
        activeIdentityRef.current = null;
        metadataRef.current = EMPTY_METADATA;
        lastLoadedAtRef.current = null;
        currentConfigHashRef.current = null;
        reloadPromiseRef.current = null;
        setTemplates(null);
        setCategoryTypes(null);
        setFilterOptions(null);
        setTodoStates(null);
        setCustomViews(null);
        setHabitConfig(null);
        setExposedFunctions(null);
        setError(null);
        setIsLoading(false);
        setHasLoadedOnce(false);
        return;
      }

      const identityChanged = activeIdentityRef.current !== identityKey;
      activeIdentityRef.current = identityKey;
      if (identityChanged) {
        metadataRef.current = EMPTY_METADATA;
        lastLoadedAtRef.current = null;
        currentConfigHashRef.current = null;
        reloadPromiseRef.current = null;
        setTemplates(null);
        setCategoryTypes(null);
        setFilterOptions(null);
        setTodoStates(null);
        setCustomViews(null);
        setHabitConfig(null);
        setExposedFunctions(null);
        setError(null);
        setHasLoadedOnce(false);
      }

      const cached = await getCachedMetadata(apiUrl, username);
      if (cancelled) {
        return;
      }

      if (cached) {
        applyMetadata(cached.metadata, { preserveExisting: false });
        lastLoadedAtRef.current = Date.parse(cached.cachedAt);
        currentConfigHashRef.current = cached.configHash;
        setHasLoadedOnce(true);
      }

      if (
        !cached ||
        !cached.metadata.habitConfig ||
        !isCachedMetadataFresh(cached.cachedAt)
      ) {
        await fetchTemplates({ background: Boolean(cached) });
      }
    }

    void loadInitialMetadata();

    return () => {
      cancelled = true;
    };
  }, [
    api,
    apiUrl,
    applyMetadata,
    fetchTemplates,
    identityKey,
    isAuthenticated,
    username,
  ]);

  useEffect(() => {
    if (!identityKey) {
      return;
    }

    return subscribeToConfigHash((event) => {
      if (event.identityKey !== identityKey) {
        return;
      }

      if (
        event.configHash === currentConfigHashRef.current ||
        reloadPromiseRef.current?.identityKey === identityKey
      ) {
        return;
      }

      void fetchTemplates({ background: true });
    });
  }, [fetchTemplates, identityKey]);

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

  return (
    <TemplatesContext.Provider
      value={{
        templates,
        categoryTypes,
        filterOptions,
        todoStates,
        customViews,
        habitConfig,
        exposedFunctions,
        isLoading: isLoading || (isAuthenticated && !hasLoadedOnce),
        error,
        reloadTemplates,
        ensureFreshTemplates,
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
