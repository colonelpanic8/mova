import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useMemo } from "react";

/**
 * The done state used when quick-completing a todo: the user's configured
 * default if set, otherwise auto-detected from the server's done states
 * (preferring "DONE", falling back to the first done state).
 */
export function useEffectiveDoneState(): string {
  const { defaultDoneState } = useSettings();
  const { todoStates } = useTemplates();

  return useMemo(() => {
    if (defaultDoneState) return defaultDoneState;
    if (!todoStates?.done?.length) return "DONE";
    return todoStates.done.includes("DONE") ? "DONE" : todoStates.done[0];
  }, [defaultDoneState, todoStates]);
}
