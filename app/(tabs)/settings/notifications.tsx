import { useNotificationSync } from "@/hooks/useNotificationSync";
import {
  cancelNotification,
  getAllScheduledNotifications,
  ScheduledNotificationInfo,
} from "@/services/notifications";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Text,
  useTheme,
} from "react-native-paper";

function formatScheduledTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 0) return "Past";
  if (diffMins < 1) return "Less than 1 min";
  if (diffMins < 60) return `In ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    if (remainingMins === 0) return `In ${diffHours}h`;
    return `In ${diffHours}h ${remainingMins}m`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString();
}

function formatFullDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<
    ScheduledNotificationInfo[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { syncNotifications, isSyncing } = useNotificationSync();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const notifs = await getAllScheduledNotifications();
      setNotifications(notifs);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleCancelNotification = useCallback(
    (notification: ScheduledNotificationInfo) => {
      Alert.alert(
        "Cancel Notification",
        `Remove the notification for "${notification.title}"?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Notification",
            style: "destructive",
            onPress: async () => {
              await cancelNotification(notification.identifier);
              await loadNotifications();
            },
          },
        ],
      );
    },
    [loadNotifications],
  );

  const handleRefresh = useCallback(async () => {
    await syncNotifications();
    await loadNotifications();
  }, [syncNotifications, loadNotifications]);

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text variant="titleMedium">
          {notifications.length} scheduled notification
          {notifications.length !== 1 ? "s" : ""}
        </Text>
        <Button
          mode="text"
          onPress={handleRefresh}
          loading={isSyncing}
          disabled={isSyncing}
          icon="refresh"
          compact
        >
          Refresh
        </Button>
      </View>

      <Divider />

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <List.Icon icon="bell-off-outline" />
          <Text variant="bodyLarge" style={styles.emptyText}>
            No scheduled notifications
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtext, { color: theme.colors.outline }]}
          >
            Notifications will appear here when you have upcoming reminders for
            scheduled items
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {notifications.map((notification, index) => (
            <Card
              key={notification.identifier}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              mode="contained"
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardMain}>
                  <Text
                    variant="titleSmall"
                    numberOfLines={2}
                    style={styles.notificationTitle}
                  >
                    {notification.title}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.outline }}
                  >
                    {notification.body}
                  </Text>
                  <View style={styles.timeRow}>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.primary }}
                    >
                      {formatScheduledTime(notification.scheduledTime)}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.outline }}
                    >
                      {formatFullDateTime(notification.scheduledTime)}
                    </Text>
                  </View>
                </View>
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => handleCancelNotification(notification)}
                  style={styles.cancelButton}
                />
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 48,
  },
  emptyText: {
    marginTop: 16,
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  cancelButton: {
    margin: -8,
    marginLeft: 8,
  },
});
