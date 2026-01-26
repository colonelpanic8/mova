import {
  getDefaultDoneState,
  getQuickScheduleIncludeTime,
  getShowHabitsInAgenda,
  getUseClientCompletionTime,
  setDefaultDoneState as saveDefaultDoneState,
  setQuickScheduleIncludeTime as saveQuickScheduleIncludeTime,
  setShowHabitsInAgenda as saveShowHabitsInAgenda,
  setUseClientCompletionTime as saveUseClientCompletionTime,
} from "@/services/settings";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface SettingsContextType {
  quickScheduleIncludeTime: boolean;
  setQuickScheduleIncludeTime: (value: boolean) => Promise<void>;
  showHabitsInAgenda: boolean;
  setShowHabitsInAgenda: (value: boolean) => Promise<void>;
  defaultDoneState: string | null;
  setDefaultDoneState: (value: string | null) => Promise<void>;
  useClientCompletionTime: boolean;
  setUseClientCompletionTime: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [quickScheduleIncludeTime, setQuickScheduleIncludeTimeState] =
    useState(false);
  const [showHabitsInAgenda, setShowHabitsInAgendaState] = useState(false);
  const [defaultDoneState, setDefaultDoneStateState] = useState<string | null>(
    null,
  );
  const [useClientCompletionTime, setUseClientCompletionTimeState] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getQuickScheduleIncludeTime(),
      getShowHabitsInAgenda(),
      getDefaultDoneState(),
      getUseClientCompletionTime(),
    ]).then(
      ([
        quickScheduleValue,
        showHabitsValue,
        defaultDoneValue,
        useClientCompletionTimeValue,
      ]) => {
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
        setDefaultDoneStateState(defaultDoneValue);
        setUseClientCompletionTimeState(useClientCompletionTimeValue);
        setIsLoading(false);
      },
    );
  }, []);

  const setQuickScheduleIncludeTime = useCallback(async (value: boolean) => {
    setQuickScheduleIncludeTimeState(value);
    await saveQuickScheduleIncludeTime(value);
  }, []);

  const setShowHabitsInAgenda = useCallback(async (value: boolean) => {
    setShowHabitsInAgendaState(value);
    await saveShowHabitsInAgenda(value);
  }, []);

  const setDefaultDoneState = useCallback(async (value: string | null) => {
    setDefaultDoneStateState(value);
    await saveDefaultDoneState(value);
  }, []);

  const setUseClientCompletionTime = useCallback(async (value: boolean) => {
    setUseClientCompletionTimeState(value);
    await saveUseClientCompletionTime(value);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        quickScheduleIncludeTime,
        setQuickScheduleIncludeTime,
        showHabitsInAgenda,
        setShowHabitsInAgenda,
        defaultDoneState,
        setDefaultDoneState,
        useClientCompletionTime,
        setUseClientCompletionTime,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
