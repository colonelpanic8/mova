import {
  getDefaultDoneState,
  getGroupByCategory,
  getMultiDayPastDays,
  getMultiDayRangeLength,
  getQuickScheduleIncludeTime,
  getShowHabitsInAgenda,
  getUseClientCompletionTime,
  setDefaultDoneState as saveDefaultDoneState,
  setGroupByCategory as saveGroupByCategory,
  setMultiDayPastDays as saveMultiDayPastDays,
  setMultiDayRangeLength as saveMultiDayRangeLength,
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
  multiDayRangeLength: number;
  setMultiDayRangeLength: (value: number) => Promise<void>;
  multiDayPastDays: number;
  setMultiDayPastDays: (value: number) => Promise<void>;
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
  const [multiDayRangeLength, setMultiDayRangeLengthState] = useState(7);
  const [multiDayPastDays, setMultiDayPastDaysState] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getQuickScheduleIncludeTime(),
      getShowHabitsInAgenda(),
      getDefaultDoneState(),
      getUseClientCompletionTime(),
      getGroupByCategory(),
      getMultiDayRangeLength(),
      getMultiDayPastDays(),
    ]).then(
      ([
        quickScheduleValue,
        showHabitsValue,
        defaultDoneValue,
        useClientCompletionTimeValue,
        groupByCategoryValue,
        multiDayRangeLengthValue,
        multiDayPastDaysValue,
      ]) => {
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
        setDefaultDoneStateState(defaultDoneValue);
        setUseClientCompletionTimeState(useClientCompletionTimeValue);
        setGroupByCategoryState(groupByCategoryValue);
        setMultiDayRangeLengthState(multiDayRangeLengthValue);
        setMultiDayPastDaysState(multiDayPastDaysValue);
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

  const setMultiDayRangeLength = useCallback(
    async (value: number) => {
      setMultiDayRangeLengthState(value);
      await saveMultiDayRangeLength(value);
      // Auto-cap pastDays if it exceeds new range
      if (multiDayPastDays >= value) {
        const cappedPastDays = Math.max(0, value - 1);
        setMultiDayPastDaysState(cappedPastDays);
        await saveMultiDayPastDays(cappedPastDays);
      }
    },
    [multiDayPastDays],
  );

  const setMultiDayPastDays = useCallback(
    async (value: number) => {
      // Ensure pastDays doesn't exceed rangeLength - 1
      const cappedValue = Math.min(value, multiDayRangeLength - 1);
      setMultiDayPastDaysState(cappedValue);
      await saveMultiDayPastDays(cappedValue);
    },
    [multiDayRangeLength],
  );

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
        multiDayRangeLength,
        setMultiDayRangeLength,
        multiDayPastDays,
        setMultiDayPastDays,
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
