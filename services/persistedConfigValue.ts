import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PersistedNumberConfig {
  /** Read the stored value (clamped), or the default when unset. */
  get: () => Promise<number>;
  /** Clamp, persist, and broadcast the value; returns the effective value. */
  set: (value: number) => Promise<number>;
  /** Subscribe to changes made via set(); returns an unsubscribe function. */
  subscribe: (listener: (value: number) => void) => () => void;
}

/**
 * A numeric setting persisted in AsyncStorage with clamping and change
 * listeners. Non-finite values fall back to the default; finite values are
 * rounded and clamped to [min, max].
 */
export function createPersistedNumberConfig(options: {
  storageKey: string;
  defaultValue: number;
  min?: number;
  max?: number;
}): PersistedNumberConfig {
  const {
    storageKey,
    defaultValue,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
  } = options;

  const listeners = new Set<(value: number) => void>();

  function clamp(value: number): number {
    if (!Number.isFinite(value)) return defaultValue;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function notify(value: number) {
    for (const listener of listeners) {
      try {
        listener(value);
      } catch {
        // Ignore misbehaving listeners.
      }
    }
  }

  return {
    async get() {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return defaultValue;
      return clamp(parseInt(raw, 10));
    },
    async set(value: number) {
      const effective = clamp(value);
      await AsyncStorage.setItem(storageKey, String(effective));
      notify(effective);
      return effective;
    },
    subscribe(listener: (value: number) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
