import {
  getQuickScheduleIncludeTime,
  getShowHabitsInAgenda,
  setQuickScheduleIncludeTime as saveQuickScheduleIncludeTime,
  setShowHabitsInAgenda as saveShowHabitsInAgenda,
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
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [quickScheduleIncludeTime, setQuickScheduleIncludeTimeState] =
    useState(false);
  const [showHabitsInAgenda, setShowHabitsInAgendaState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getQuickScheduleIncludeTime(), getShowHabitsInAgenda()]).then(
      ([quickScheduleValue, showHabitsValue]) => {
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
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

  return (
    <SettingsContext.Provider
      value={{
        quickScheduleIncludeTime,
        setQuickScheduleIncludeTime,
        showHabitsInAgenda,
        setShowHabitsInAgenda,
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
