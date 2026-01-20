import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { AgendaFilesResponse, api, VersionResponse } from "@/services/api";
import {
  getNotificationsEnabled,
  requestNotificationPermissions,
  setNotificationsEnabled,
} from "@/services/notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  List,
  Switch,
  useTheme,
} from "react-native-paper";

export default function SettingsScreen() {
  const { apiUrl, username, password, logout } = useAuth();
  const { quickScheduleIncludeTime, setQuickScheduleIncludeTime } =
    useSettings();
  const theme = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [backendVersion, setBackendVersion] = useState<VersionResponse | null>(
    null,
  );
  const [agendaFiles, setAgendaFiles] = useState<AgendaFilesResponse | null>(
    null,
  );
  const { lastSync, scheduledCount, isSyncing, syncNotifications } =
    useNotificationSync();

  // Mova version info from Expo Constants
  const movaVersion = Constants.expoConfig?.version || "unknown";
  const movaGitCommit = Constants.expoConfig?.extra?.gitCommit || "dev";

  useEffect(() => {
    getNotificationsEnabled().then((enabled) => {
      setNotificationsEnabledState(enabled);
      setLoadingNotifications(false);
    });
  }, []);

  // Fetch backend version and agenda files when connected
  useEffect(() => {
    if (apiUrl) {
      api
        .getVersion()
        .then(setBackendVersion)
        .catch((error) => {
          console.error("Failed to fetch backend version:", error);
          setBackendVersion(null);
        });
      api
        .getAgendaFiles()
        .then(setAgendaFiles)
        .catch((error) => {
          console.error("Failed to fetch agenda files:", error);
          setAgendaFiles(null);
        });
    }
  }, [apiUrl]);

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
        syncNotifications();
      }
    },
    [syncNotifications],
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
              ? `${backendVersion.version} (${backendVersion.gitCommit})`
              : "Not connected"
          }
          left={(props) => <List.Icon {...props} icon="server" />}
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
});
