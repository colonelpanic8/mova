import {
  armPin,
  completePin,
  isPinsAvailable,
  listPins,
  Pin,
  snoozePin,
  subscribeToPinChanges,
  syncPresetsToWatch,
} from "@/services/pins";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export function usePins() {
  const available = isPinsAvailable();
  const [pins, setPins] = useState<Pin[]>([]);

  const refresh = useCallback(async () => {
    if (!available) return;
    setPins(await listPins());
  }, [available]);

  useEffect(() => {
    if (!available) return;
    refresh();
    // Ensure the watch has the current presets whenever pins are in use.
    syncPresetsToWatch();

    const unsubscribe = subscribeToPinChanges(refresh);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") refresh();
      },
    );
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [available, refresh]);

  const arm = useCallback(
    async (title: string, escalateMinutes: number | null) => {
      await armPin(title, escalateMinutes);
      await refresh();
    },
    [refresh],
  );

  const complete = useCallback(
    async (id: string) => {
      await completePin(id);
      await refresh();
    },
    [refresh],
  );

  const snooze = useCallback(
    async (id: string, minutes: number) => {
      await snoozePin(id, minutes);
      await refresh();
    },
    [refresh],
  );

  return { available, pins, refresh, arm, complete, snooze };
}
