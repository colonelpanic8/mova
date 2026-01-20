import {
  getQuickScheduleIncludeTime,
  setQuickScheduleIncludeTime as saveQuickScheduleIncludeTime,
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
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [quickScheduleIncludeTime, setQuickScheduleIncludeTimeState] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getQuickScheduleIncludeTime().then((value) => {
      setQuickScheduleIncludeTimeState(value);
      setIsLoading(false);
    });
  }, []);

  const setQuickScheduleIncludeTime = useCallback(async (value: boolean) => {
    setQuickScheduleIncludeTimeState(value);
    await saveQuickScheduleIncludeTime(value);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        quickScheduleIncludeTime,
        setQuickScheduleIncludeTime,
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
