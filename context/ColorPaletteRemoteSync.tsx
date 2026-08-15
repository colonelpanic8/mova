import { useApi } from "@/context/ApiContext";
import {
  mergeWithDefaultPalette,
  useColorPalette,
} from "@/context/ColorPaletteContext";
import { ColorPaletteConfig } from "@/types/colors";
import { useEffect, useRef, useState } from "react";

export const APP_CONFIG_NAMESPACE = "mova";
const PUSH_DEBOUNCE_MS = 1500;

interface MovaAppConfig {
  colorPalette?: Partial<ColorPaletteConfig>;
  [key: string]: unknown;
}

/**
 * Syncs the color palette with the server-side app-config store, which
 * persists it as a JSON file inside the org repo. Rendered inside
 * ApiProvider (ColorPaletteProvider itself sits above it in the tree).
 *
 * Pull-then-push: on startup the server copy wins; afterwards local edits
 * are debounced and pushed. AsyncStorage remains the offline cache.
 */
export function ColorPaletteRemoteSync() {
  const api = useApi();
  const { config, isLoading, hydrateFromRemote } = useColorPalette();
  // Full server blob for the namespace, so pushes preserve keys other
  // than colorPalette.
  const remoteBlobRef = useRef<MovaAppConfig>({});
  const lastSyncedRef = useRef<string | null>(null);
  const [pulled, setPulled] = useState(false);

  useEffect(() => {
    if (!api || isLoading || pulled) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.getAppConfig(APP_CONFIG_NAMESPACE);
        if (cancelled) return;
        const blob = (response.config ?? {}) as MovaAppConfig;
        remoteBlobRef.current = blob;
        if (response.exists && blob.colorPalette) {
          const merged = mergeWithDefaultPalette(blob.colorPalette);
          lastSyncedRef.current = JSON.stringify(merged);
          await hydrateFromRemote(blob.colorPalette);
        }
        setPulled(true);
      } catch (error) {
        console.warn("Failed to load app config from server:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, isLoading, pulled, hydrateFromRemote]);

  useEffect(() => {
    if (!api || isLoading || !pulled) return;
    const serialized = JSON.stringify(config);
    if (serialized === lastSyncedRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const blob = { ...remoteBlobRef.current, colorPalette: config };
        await api.putAppConfig(APP_CONFIG_NAMESPACE, blob);
        remoteBlobRef.current = blob;
        lastSyncedRef.current = serialized;
      } catch (error) {
        console.warn("Failed to push app config to server:", error);
      }
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [api, config, isLoading, pulled]);

  return null;
}
