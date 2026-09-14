import {
  getAllowHeadlessIntentWrites,
  getDefaultDoneState,
  getExtendTodayUntilHour,
  getGroupByCategory,
  getMultiDayPastDays,
  getMultiDayRangeLength,
  getQuickScheduleIncludeTime,
  getServerExtendTodayUntilHour,
  getShowHabitsInAgenda,
  getUseClientCompletionTime,
  setAllowHeadlessIntentWrites as saveAllowHeadlessIntentWrites,
  setDefaultDoneState as saveDefaultDoneState,
  setExtendTodayUntilHour as saveExtendTodayUntilHour,
  setGroupByCategory as saveGroupByCategory,
  setMultiDayPastDays as saveMultiDayPastDays,
  setMultiDayRangeLength as saveMultiDayRangeLength,
  setQuickScheduleIncludeTime as saveQuickScheduleIncludeTime,
  setShowHabitsInAgenda as saveShowHabitsInAgenda,
  setUseClientCompletionTime as saveUseClientCompletionTime,
  subscribeToServerExtendTodayUntilHour,
} from "@/services/settings";
import { saveIntentWritePolicy } from "@/widgets/storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface SettingsContextType {
  allowHeadlessIntentWrites: boolean;
  setAllowHeadlessIntentWrites: (value: boolean) => Promise<void>;
  quickScheduleIncludeTime: boolean;
  setQuickScheduleIncludeTime: (value: boolean) => Promise<void>;
  showHabitsInAgenda: boolean;
  setShowHabitsInAgenda: (value: boolean) => Promise<void>;
  defaultDoneState: string | null;
  setDefaultDoneState: (value: string | null) => Promise<void>;
  useClientCompletionTime: boolean;
  setUseClientCompletionTime: (value: boolean) => Promise<void>;
  /**
   * Effective org-extend-today-until: hour before which "today" is still
   * yesterday. The server's org config wins; the device value is only a
   * fallback for servers that do not report one.
   */
  extendTodayUntilHour: number;
  /** The server's value, or null when it reports none. */
  serverExtendTodayUntilHour: number | null;
  /** The device fallback, editable in Settings. */
  deviceExtendTodayUntilHour: number;
  setExtendTodayUntilHour: (value: number) => Promise<void>;
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
  const [allowHeadlessIntentWrites, setAllowHeadlessIntentWritesState] =
    useState(false);
  const [quickScheduleIncludeTime, setQuickScheduleIncludeTimeState] =
    useState(false);
  const [showHabitsInAgenda, setShowHabitsInAgendaState] = useState(false);
  const [defaultDoneState, setDefaultDoneStateState] = useState<string | null>(
    null,
  );
  const [useClientCompletionTime, setUseClientCompletionTimeState] =
    useState(true);
  const [deviceExtendTodayUntilHour, setExtendTodayUntilHourState] =
    useState(0);
  const [serverExtendTodayUntilHour, setServerExtendTodayUntilHourState] =
    useState<number | null>(null);
  const [groupByCategory, setGroupByCategoryState] = useState(false);
  const [multiDayRangeLength, setMultiDayRangeLengthState] = useState(7);
  const [multiDayPastDays, setMultiDayPastDaysState] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllowHeadlessIntentWrites(),
      getQuickScheduleIncludeTime(),
      getShowHabitsInAgenda(),
      getDefaultDoneState(),
      getUseClientCompletionTime(),
      getExtendTodayUntilHour(),
      getServerExtendTodayUntilHour(),
      getGroupByCategory(),
      getMultiDayRangeLength(),
      getMultiDayPastDays(),
    ]).then(
      async ([
        allowHeadlessIntentWritesValue,
        quickScheduleValue,
        showHabitsValue,
        defaultDoneValue,
        useClientCompletionTimeValue,
        extendTodayUntilHourValue,
        serverExtendTodayUntilHourValue,
        groupByCategoryValue,
        multiDayRangeLengthValue,
        multiDayPastDaysValue,
      ]) => {
        setAllowHeadlessIntentWritesState(allowHeadlessIntentWritesValue);
        setQuickScheduleIncludeTimeState(quickScheduleValue);
        setShowHabitsInAgendaState(showHabitsValue);
        setDefaultDoneStateState(defaultDoneValue);
        setUseClientCompletionTimeState(useClientCompletionTimeValue);
        setExtendTodayUntilHourState(extendTodayUntilHourValue);
        setServerExtendTodayUntilHourState(serverExtendTodayUntilHourValue);
        setGroupByCategoryState(groupByCategoryValue);
        setMultiDayRangeLengthState(multiDayRangeLengthValue);
        setMultiDayPastDaysState(multiDayPastDaysValue);
        await saveIntentWritePolicy(allowHeadlessIntentWritesValue);
        setIsLoading(false);
      },
    );
  }, []);

  const setAllowHeadlessIntentWrites = useCallback(async (value: boolean) => {
    setAllowHeadlessIntentWritesState(value);
    await Promise.all([
      saveAllowHeadlessIntentWrites(value),
      saveIntentWritePolicy(value),
    ]);
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

  // The metadata fetch mirrors the server's org config into storage; follow it
  // so the effective value updates without a restart.
  useEffect(
    () =>
      subscribeToServerExtendTodayUntilHour(setServerExtendTodayUntilHourState),
    [],
  );

  const setExtendTodayUntilHour = useCallback(async (value: number) => {
    setExtendTodayUntilHourState(value);
    await saveExtendTodayUntilHour(value);
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

  const value = useMemo<SettingsContextType>(
    () => ({
      allowHeadlessIntentWrites,
      setAllowHeadlessIntentWrites,
      quickScheduleIncludeTime,
      setQuickScheduleIncludeTime,
      showHabitsInAgenda,
      setShowHabitsInAgenda,
      defaultDoneState,
      setDefaultDoneState,
      useClientCompletionTime,
      setUseClientCompletionTime,
      extendTodayUntilHour:
        serverExtendTodayUntilHour ?? deviceExtendTodayUntilHour,
      serverExtendTodayUntilHour,
      deviceExtendTodayUntilHour,
      setExtendTodayUntilHour,
      groupByCategory,
      setGroupByCategory,
      multiDayRangeLength,
      setMultiDayRangeLength,
      multiDayPastDays,
      setMultiDayPastDays,
      isLoading,
    }),
    [
      allowHeadlessIntentWrites,
      setAllowHeadlessIntentWrites,
      quickScheduleIncludeTime,
      setQuickScheduleIncludeTime,
      showHabitsInAgenda,
      setShowHabitsInAgenda,
      defaultDoneState,
      setDefaultDoneState,
      useClientCompletionTime,
      setUseClientCompletionTime,
      serverExtendTodayUntilHour,
      deviceExtendTodayUntilHour,
      setExtendTodayUntilHour,
      groupByCategory,
      setGroupByCategory,
      multiDayRangeLength,
      setMultiDayRangeLength,
      multiDayPastDays,
      setMultiDayPastDays,
      isLoading,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
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
