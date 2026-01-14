import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, List, Divider, Switch, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  requestNotificationPermissions,
  getScheduledNotificationCount,
  getLastSyncTime,
} from '@/services/notifications';
import { useNotificationSync } from '@/hooks/useNotificationSync';

export default function SettingsScreen() {
  const { apiUrl, username, logout } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const { lastSync, scheduledCount, isSyncing, syncNotifications } = useNotificationSync();

  useEffect(() => {
    getNotificationsEnabled().then((enabled) => {
      setNotificationsEnabledState(enabled);
      setLoadingNotifications(false);
    });
  }, []);

  const handleNotificationToggle = useCallback(async (value: boolean) => {
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
  }, [syncNotifications]);

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return date.toLocaleDateString();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Section>
        <List.Subheader>Connection</List.Subheader>
        <List.Item
          title="Server URL"
          description={apiUrl || 'Not connected'}
          left={props => <List.Icon {...props} icon="server" />}
        />
        <List.Item
          title="Username"
          description={username || 'Not logged in'}
          left={props => <List.Icon {...props} icon="account" />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Enable Notifications"
          description="Get reminders for scheduled items"
          left={props => <List.Icon {...props} icon="bell" />}
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
              left={props => <List.Icon {...props} icon="calendar-clock" />}
            />
            <List.Item
              title="Last Sync"
              description={formatLastSync(lastSync)}
              left={props => <List.Icon {...props} icon="sync" />}
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
          left={props => <List.Icon {...props} icon="palette" />}
          onPress={() => router.push('/settings/colors')}
          right={props => <List.Icon {...props} icon="chevron-right" />}
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
          left={props => <List.Icon {...props} icon="information" />}
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
    borderColor: 'transparent',
  },
});
