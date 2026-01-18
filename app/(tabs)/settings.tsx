import { useAuth } from "@/context/AuthContext";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { api, AgendaFile } from "@/services/api";
import {
  getNotificationsEnabled,
  requestNotificationPermissions,
  setNotificationsEnabled,
} from "@/services/notifications";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  List,
  Switch,
  useTheme,
} from "react-native-paper";

export default function SettingsScreen() {
  const { apiUrl, username, logout } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [agendaFiles, setAgendaFiles] = useState<AgendaFile[]>([]);
  const [loadingAgendaFiles, setLoadingAgendaFiles] = useState(true);
  const { lastSync, scheduledCount, isSyncing, syncNotifications } =
    useNotificationSync();

  useEffect(() => {
    getNotificationsEnabled().then((enabled) => {
      setNotificationsEnabledState(enabled);
      setLoadingNotifications(false);
    });
  }, []);

  useEffect(() => {
    api
      .getAgendaFiles()
      .then((response) => {
        setAgendaFiles(response.files);
      })
      .catch((error) => {
        console.error("Failed to fetch agenda files:", error);
      })
      .finally(() => {
        setLoadingAgendaFiles(false);
      });
  }, []);

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
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>
          Agenda Files {!loadingAgendaFiles && `(${agendaFiles.length})`}
        </List.Subheader>
        {loadingAgendaFiles ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
          </View>
        ) : agendaFiles.length === 0 ? (
          <List.Item
            title="No agenda files configured"
            left={(props) => <List.Icon {...props} icon="alert-circle-outline" />}
          />
        ) : (
          agendaFiles.map((file, index) => {
            const icon = file.exists
              ? file.readable
                ? "check-circle"
                : "alert"
              : "close-circle";
            const color = file.exists
              ? file.readable
                ? theme.colors.primary
                : theme.colors.error
              : theme.colors.error;
            const status = file.exists
              ? file.readable
                ? "OK"
                : "Not readable"
              : "File not found";
            return (
              <List.Item
                key={index}
                title={file.path}
                titleNumberOfLines={2}
                titleStyle={styles.filePath}
                description={status}
                left={(props) => (
                  <List.Icon {...props} icon={icon} color={color} />
                )}
              />
            );
          })
        )}
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
          onPress={() => router.push("/settings/colors")}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
        />
      </List.Section>

      <Divider />

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
          description="Mobile client for org-agenda-api"
          left={(props) => <List.Icon {...props} icon="information" />}
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
  loadingContainer: {
    padding: 16,
    alignItems: "center",
  },
  filePath: {
    fontSize: 13,
  },
});
