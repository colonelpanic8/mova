import {
  getDefaultDoneState,
  getGroupByCategory,
  getQuickScheduleIncludeTime,
  getShowHabitsInAgenda,
  getUseClientCompletionTime,
  setDefaultDoneState as saveDefaultDoneState,
  setGroupByCategory as saveGroupByCategory,
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
  groupByCategory: boolean;
  setGroupByCategory: (value: boolean) => Promise<void>;
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
  const [groupByCategory, setGroupByCategoryState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getQuickScheduleIncludeTime(),
      getShowHabitsInAgenda(),
      getDefaultDoneState(),
      getUseClientCompletionTime(),
      getGroupByCategory(),
    ]).then(
      ([
        quickScheduleValue,
        showHabitsValue,
        defaultDoneValue,
        useClientCompletionTimeValue,
        groupByCategoryValue,
      ]) => {
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
        setDefaultDoneStateState(defaultDoneValue);
        setUseClientCompletionTimeState(useClientCompletionTimeValue);
        setGroupByCategoryState(groupByCategoryValue);
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

  const setGroupByCategory = useCallback(async (value: boolean) => {
    setGroupByCategoryState(value);
    await saveGroupByCategory(value);
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
        groupByCategory,
        setGroupByCategory,
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
