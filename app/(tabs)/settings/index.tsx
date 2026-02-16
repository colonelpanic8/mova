import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useMutation } from "@/context/MutationContext";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { AgendaFilesResponse, VersionResponse } from "@/services/api";
import {
  getBackgroundSyncStatus,
  isBackgroundSyncRegistered,
  registerBackgroundSync,
  unregisterBackgroundSync,
} from "@/services/backgroundSync";
import {
  DEFAULT_NOTIFICATION_HORIZON_DAYS,
  getNotificationHorizonDays,
  setNotificationHorizonDays,
} from "@/services/notificationHorizonConfig";
import {
  getNotificationsEnabled,
  requestNotificationPermissions,
  setNotificationsEnabled,
} from "@/services/notifications";
import {
  DEFAULT_SYNC_INTERVAL_MINUTES,
  getNotificationSyncIntervalMinutes,
  setNotificationSyncIntervalMinutes,
} from "@/services/notificationSyncConfig";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  List,
  Menu,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";

export default function SettingsScreen() {
  const api = useApi();
  const {
    apiUrl,
    username,
    password,
    logout,
    savedServers,
    activeServerId,
    updateServer,
  } = useAuth();
  const {
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
  } = useSettings();

  const multiDayFutureDays = multiDayRangeLength - multiDayPastDays - 1;
  const { templates, todoStates, exposedFunctions } = useTemplates();
  const { triggerRefresh } = useMutation();
  const theme = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [backgroundSyncRegistered, setBackgroundSyncRegistered] = useState<
    boolean | null
  >(null);
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState<
    number | null
  >(null);
  const [syncIntervalMinutes, setSyncIntervalMinutesState] = useState<number>(
    DEFAULT_SYNC_INTERVAL_MINUTES,
  );
  const [syncIntervalMenuVisible, setSyncIntervalMenuVisible] = useState(false);
  const [horizonDays, setHorizonDaysState] = useState<number>(
    DEFAULT_NOTIFICATION_HORIZON_DAYS,
  );
  const [horizonMenuVisible, setHorizonMenuVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [backendVersion, setBackendVersion] = useState<VersionResponse | null>(
    null,
  );
  const [agendaFiles, setAgendaFiles] = useState<AgendaFilesResponse | null>(
    null,
  );
  const [connectionError, setConnectionError] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const { lastSync, scheduledCount, isSyncing, syncNotifications } =
    useNotificationSync({
      autoSync: false,
      syncOnForeground: false,
      prefireVerification: false,
      registerBackgroundSync: false,
    });
  const [templateMenuVisible, setTemplateMenuVisible] = useState(false);
  const [doneStateMenuVisible, setDoneStateMenuVisible] = useState(false);
  const [callingFunction, setCallingFunction] = useState<string | null>(null);

  const activeServer = useMemo(
    () => savedServers.find((s) => s.id === activeServerId),
    [savedServers, activeServerId],
  );

  const templateOptions = useMemo(() => {
    if (!templates) return [];
    return Object.entries(templates).map(([key, template]) => ({
      key,
      name: template.name,
    }));
  }, [templates]);

  const selectedTemplateName = useMemo(() => {
    if (!activeServer?.defaultCaptureTemplate || !templates) return "Not set";
    const template = templates[activeServer.defaultCaptureTemplate];
    return template?.name || "Not set";
  }, [activeServer?.defaultCaptureTemplate, templates]);

  // Compute effective default done state (setting or auto-detect)
  const effectiveDefaultDoneState = useMemo(() => {
    if (defaultDoneState) return defaultDoneState;
    if (!todoStates?.done?.length) return "DONE";
    // Default to "DONE" if it exists, otherwise first done state
    return todoStates.done.includes("DONE") ? "DONE" : todoStates.done[0];
  }, [defaultDoneState, todoStates]);

  const handleDoneStateSelect = useCallback(
    async (state: string | null) => {
      setDoneStateMenuVisible(false);
      await setDefaultDoneState(state);
    },
    [setDefaultDoneState],
  );

  const handleTemplateSelect = useCallback(
    async (templateKey: string) => {
      setTemplateMenuVisible(false);
      if (activeServerId) {
        await updateServer(activeServerId, {
          defaultCaptureTemplate: templateKey,
        });
      }
    },
    [activeServerId, updateServer],
  );

  const handleCallFunction = useCallback(
    async (functionId: string) => {
      if (!api) return;
      setCallingFunction(functionId);
      try {
        await api.callFunction(functionId);
        // Trigger refresh since the function may have modified data
        triggerRefresh();
      } catch (error) {
        console.error("Failed to call function:", error);
      } finally {
        setCallingFunction(null);
      }
    },
    [api, triggerRefresh],
  );

  // Mova version info from Expo Constants
  const movaVersion = Constants.expoConfig?.version || "unknown";
  const movaGitCommit = Constants.expoConfig?.extra?.gitCommit || "dev";

  useEffect(() => {
    getNotificationsEnabled().then((enabled) => {
      setNotificationsEnabledState(enabled);
      setLoadingNotifications(false);
    });
  }, []);

  useEffect(() => {
    getNotificationSyncIntervalMinutes()
      .then(setSyncIntervalMinutesState)
      .catch(() => {
        // Keep default.
      });
  }, []);

  useEffect(() => {
    getNotificationHorizonDays()
      .then(setHorizonDaysState)
      .catch(() => {
        // Keep default.
      });
  }, []);

  const refreshBackgroundSyncInfo = useCallback(async () => {
    try {
      const [registered, status] = await Promise.all([
        isBackgroundSyncRegistered(),
        getBackgroundSyncStatus(),
      ]);
      setBackgroundSyncRegistered(registered);
      // BackgroundFetchStatus is a numeric enum in expo-background-fetch.
      setBackgroundSyncStatus(status as unknown as number | null);
    } catch (e) {
      console.error("Failed to fetch background sync status:", e);
      setBackgroundSyncRegistered(null);
      setBackgroundSyncStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshBackgroundSyncInfo();
  }, [refreshBackgroundSyncInfo]);

  // Function to check server connection and fetch version/files
  const checkConnection = useCallback(async () => {
    if (!api) return;

    setIsCheckingConnection(true);
    setConnectionError(false);

    try {
      const version = await api.getVersion();
      setBackendVersion(version);
      setConnectionError(false);
    } catch (error) {
      console.error("Failed to fetch backend version:", error);
      setBackendVersion(null);
      setConnectionError(true);
    }

    try {
      const files = await api.getAgendaFiles();
      setAgendaFiles(files);
    } catch (error) {
      console.error("Failed to fetch agenda files:", error);
      setAgendaFiles(null);
    }

    setIsCheckingConnection(false);
  }, [api]);

  // Fetch backend version and agenda files when connected
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleNotificationToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          return;
        }
      }
      setNotificationsEnabledState(value);
      await setNotificationsEnabled(value);
      if (value) {
        await registerBackgroundSync();
        refreshBackgroundSyncInfo();
        syncNotifications();
      } else {
        await unregisterBackgroundSync();
        refreshBackgroundSyncInfo();
      }
    },
    [syncNotifications, refreshBackgroundSyncInfo],
  );

  const handleSyncIntervalSelect = useCallback(
    async (minutes: number) => {
      const effective = await setNotificationSyncIntervalMinutes(minutes);
      setSyncIntervalMinutesState(effective);
      setSyncIntervalMenuVisible(false);

      // Apply immediately to background fetch scheduling, when notifications are enabled.
      if (notificationsEnabled) {
        await registerBackgroundSync();
        refreshBackgroundSyncInfo();
      }
    },
    [notificationsEnabled, refreshBackgroundSyncInfo],
  );

  const handleHorizonSelect = useCallback(
    async (days: number) => {
      const effective = await setNotificationHorizonDays(days);
      setHorizonDaysState(effective);
      setHorizonMenuVisible(false);
      if (notificationsEnabled) {
        // Re-sync now so we have enough notifications scheduled ahead.
        syncNotifications();
      }
    },
    [notificationsEnabled, syncNotifications],
  );

  const formatLastSync = (date: Date | null): string => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return date.toLocaleDateString();
  };

  const formatBackgroundSyncStatus = (status: number | null): string => {
    if (status == null) return "Unknown";
    switch (status) {
      case 1:
        return "Denied";
      case 2:
        return "Restricted";
      case 3:
        return "Available";
      default:
        return `Unknown (${status})`;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <List.Section>
        <List.Subheader>Connection</List.Subheader>
        <List.Item
          title="Server URL"
          description={apiUrl || "Not connected"}
          left={(props) => <List.Icon {...props} icon="server" />}
        />
        <List.Item
          title="Username"
          description={username || "Not logged in"}
          left={(props) => <List.Icon {...props} icon="account" />}
        />
        <List.Item
          title="Password"
          description={showPassword ? password : "••••••••"}
          left={(props) => <List.Icon {...props} icon="lock" />}
          right={(props) => (
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <List.Icon {...props} icon={showPassword ? "eye-off" : "eye"} />
            </Pressable>
          )}
        />
        <List.Item
          title="Manage Servers"
          description="Switch, edit, or delete saved servers"
          left={(props) => <List.Icon {...props} icon="server-network" />}
          onPress={() => router.navigate("/(tabs)/settings/servers")}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Enable Notifications"
          description="Get reminders for scheduled items"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={() =>
            loadingNotifications ? (
              <ActivityIndicator size="small" />
            ) : (
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
              />
            )
          }
        />
        {notificationsEnabled && (
          <>
            <List.Item
              title="Sync Interval"
              description={`Every ${syncIntervalMinutes} min (best-effort)`}
              left={(props) => <List.Icon {...props} icon="timer-outline" />}
              onPress={() => setSyncIntervalMenuVisible(true)}
              right={() => (
                <Menu
                  visible={syncIntervalMenuVisible}
                  onDismiss={() => setSyncIntervalMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="chevron-down"
                      onPress={() => setSyncIntervalMenuVisible(true)}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(15)}
                    title="15 min"
                  />
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(30)}
                    title="30 min"
                  />
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(60)}
                    title="1 hour"
                  />
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(120)}
                    title="2 hours"
                  />
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(240)}
                    title="4 hours"
                  />
                  <Menu.Item
                    onPress={() => handleSyncIntervalSelect(720)}
                    title="12 hours"
                  />
                </Menu>
              )}
            />
            <List.Item
              title="Schedule Ahead"
              description={`${horizonDays} day${horizonDays === 1 ? "" : "s"} (limited by OS)`}
              left={(props) => <List.Icon {...props} icon="calendar-range" />}
              onPress={() => setHorizonMenuVisible(true)}
              right={() => (
                <Menu
                  visible={horizonMenuVisible}
                  onDismiss={() => setHorizonMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="chevron-down"
                      onPress={() => setHorizonMenuVisible(true)}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => handleHorizonSelect(1)}
                    title="1 day"
                  />
                  <Menu.Item
                    onPress={() => handleHorizonSelect(3)}
                    title="3 days"
                  />
                  <Menu.Item
                    onPress={() => handleHorizonSelect(7)}
                    title="7 days"
                  />
                  <Menu.Item
                    onPress={() => handleHorizonSelect(14)}
                    title="14 days"
                  />
                  <Menu.Item
                    onPress={() => handleHorizonSelect(30)}
                    title="30 days"
                  />
                </Menu>
              )}
            />
            <List.Item
              title="Scheduled Notifications"
              description={`${scheduledCount} upcoming`}
              left={(props) => <List.Icon {...props} icon="calendar-clock" />}
              onPress={() => router.navigate("/(tabs)/settings/notifications")}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
            />
            <List.Item
              title="Last Sync"
              description={formatLastSync(lastSync)}
              left={(props) => <List.Icon {...props} icon="sync" />}
              right={() =>
                isSyncing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Button mode="text" onPress={syncNotifications} compact>
                    Sync Now
                  </Button>
                )
              }
            />
            <List.Item
              title="Background Sync"
              description={`${backgroundSyncRegistered === null ? "Unknown" : backgroundSyncRegistered ? "Registered" : "Not registered"} · ${formatBackgroundSyncStatus(backgroundSyncStatus)}`}
              left={(props) => <List.Icon {...props} icon="clock-outline" />}
              right={() => (
                <Button mode="text" onPress={refreshBackgroundSyncInfo} compact>
                  Refresh
                </Button>
              )}
            />
          </>
        )}
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <List.Item
          title="Colors"
          description="Customize TODO state and action button colors"
          left={(props) => <List.Icon {...props} icon="palette" />}
          onPress={() => router.navigate("/(tabs)/settings/colors")}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Behavior</List.Subheader>
        <List.Item
          title="Include Time in Quick Schedule"
          description="Today/Tomorrow actions include current time"
          left={(props) => <List.Icon {...props} icon="clock-outline" />}
          right={() => (
            <Switch
              value={quickScheduleIncludeTime}
              onValueChange={setQuickScheduleIncludeTime}
            />
          )}
        />
        <List.Item
          title="Show Habits in Agenda"
          description="Display habit items in the agenda view"
          left={(props) => (
            <List.Icon {...props} icon="checkbox-multiple-marked" />
          )}
          right={() => (
            <Switch
              value={showHabitsInAgenda}
              onValueChange={setShowHabitsInAgenda}
            />
          )}
        />
        <List.Item
          title="Group by Category"
          description="Group agenda items by category"
          left={(props) => <List.Icon {...props} icon="folder-outline" />}
          right={() => (
            <Switch
              value={groupByCategory}
              onValueChange={setGroupByCategory}
            />
          )}
        />
        <List.Item
          title="Use Client Completion Time"
          description="Send local time when completing tasks"
          left={(props) => <List.Icon {...props} icon="clock-check" />}
          right={() => (
            <Switch
              value={useClientCompletionTime}
              onValueChange={setUseClientCompletionTime}
            />
          )}
        />
        <Menu
          visible={doneStateMenuVisible}
          onDismiss={() => setDoneStateMenuVisible(false)}
          anchor={
            <List.Item
              title="Default Done State"
              description={
                defaultDoneState || `Auto (${effectiveDefaultDoneState})`
              }
              left={(props) => <List.Icon {...props} icon="check-circle" />}
              onPress={() => setDoneStateMenuVisible(true)}
              right={(props) => <List.Icon {...props} icon="chevron-down" />}
            />
          }
        >
          <Menu.Item
            onPress={() => handleDoneStateSelect(null)}
            title="Auto (detect from server)"
            leadingIcon={defaultDoneState === null ? "check" : undefined}
          />
          {todoStates?.done?.map((state) => (
            <Menu.Item
              key={state}
              onPress={() => handleDoneStateSelect(state)}
              title={state}
              leadingIcon={defaultDoneState === state ? "check" : undefined}
            />
          ))}
        </Menu>
        <Menu
          visible={templateMenuVisible}
          onDismiss={() => setTemplateMenuVisible(false)}
          anchor={
            <List.Item
              title="Default Capture Template"
              description={selectedTemplateName}
              left={(props) => (
                <List.Icon {...props} icon="file-document-edit" />
              )}
              onPress={() => setTemplateMenuVisible(true)}
              right={(props) => <List.Icon {...props} icon="chevron-down" />}
            />
          }
        >
          {templateOptions.map((option) => (
            <Menu.Item
              key={option.key}
              onPress={() => handleTemplateSelect(option.key)}
              title={option.name}
              leadingIcon={
                activeServer?.defaultCaptureTemplate === option.key
                  ? "check"
                  : undefined
              }
            />
          ))}
        </Menu>
      </List.Section>

      <Divider />

      {exposedFunctions && exposedFunctions.length > 0 && (
        <>
          <List.Section>
            <List.Subheader>Server Functions</List.Subheader>
            {exposedFunctions.map((func) => (
              <List.Item
                key={func.id}
                title={func.name}
                description={func.id}
                left={(props) => <List.Icon {...props} icon="function" />}
                onPress={() => handleCallFunction(func.id)}
                right={() =>
                  callingFunction === func.id ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <IconButton
                      icon="play"
                      size={20}
                      onPress={() => handleCallFunction(func.id)}
                    />
                  )
                }
              />
            ))}
          </List.Section>
          <Divider />
        </>
      )}

      <List.Section>
        <List.Subheader>Multi-day View</List.Subheader>
        <List.Item
          title="Range Length"
          description={`${multiDayRangeLength} days total`}
          left={(props) => <List.Icon {...props} icon="calendar-range" />}
          right={() => (
            <View style={styles.stepperContainer}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() =>
                  setMultiDayRangeLength(Math.max(2, multiDayRangeLength - 1))
                }
                disabled={multiDayRangeLength <= 2}
              />
              <Text style={styles.stepperValue}>{multiDayRangeLength}</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={() =>
                  setMultiDayRangeLength(Math.min(14, multiDayRangeLength + 1))
                }
                disabled={multiDayRangeLength >= 14}
              />
            </View>
          )}
        />
        <List.Item
          title="Days Before Today"
          description={`Show ${multiDayPastDays} day${multiDayPastDays !== 1 ? "s" : ""} of past`}
          left={(props) => <List.Icon {...props} icon="history" />}
          right={() => (
            <View style={styles.stepperContainer}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() =>
                  setMultiDayPastDays(Math.max(0, multiDayPastDays - 1))
                }
                disabled={multiDayPastDays <= 0}
              />
              <Text style={styles.stepperValue}>{multiDayPastDays}</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={() =>
                  setMultiDayPastDays(
                    Math.min(multiDayRangeLength - 1, multiDayPastDays + 1),
                  )
                }
                disabled={multiDayPastDays >= multiDayRangeLength - 1}
              />
            </View>
          )}
        />
        <List.Item
          title="Days After Today"
          description={`${multiDayFutureDays} day${multiDayFutureDays !== 1 ? "s" : ""} (computed)`}
          left={(props) => <List.Icon {...props} icon="calendar-arrow-right" />}
        />
      </List.Section>

      <Divider />

      {agendaFiles && agendaFiles.files.length > 0 && (
        <>
          <List.Section>
            <List.Subheader>Org Agenda Files</List.Subheader>
            {agendaFiles.files.map((file, index) => (
              <List.Item
                key={index}
                title={file.path.split("/").pop() || file.path}
                description={file.path}
                left={(props) => <List.Icon {...props} icon="file-document" />}
              />
            ))}
          </List.Section>
          <Divider />
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={logout}
          icon="logout"
          textColor={theme.colors.error}
          style={styles.logoutButton}
        >
          Disconnect
        </Button>
      </View>

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Mova"
          description={`${movaVersion} (${movaGitCommit})`}
          left={(props) => <List.Icon {...props} icon="cellphone" />}
        />
        <List.Item
          title="Server"
          description={
            backendVersion
              ? backendVersion.version
                ? `${backendVersion.version} (${backendVersion.gitCommit || backendVersion.git_commit || "dev"})`
                : backendVersion.gitCommit ||
                  backendVersion.git_commit ||
                  "Unknown"
              : apiUrl
                ? connectionError
                  ? "Connection failed - tap to retry"
                  : "Checking connection..."
                : "Not connected"
          }
          left={(props) => <List.Icon {...props} icon="server" />}
          onPress={apiUrl ? checkConnection : undefined}
          right={
            isCheckingConnection
              ? () => <ActivityIndicator size="small" />
              : apiUrl
                ? (props) => <List.Icon {...props} icon="refresh" />
                : undefined
          }
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
  },
  logoutButton: {
    borderColor: "transparent",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 16,
  },
});
