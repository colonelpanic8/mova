import { useNotificationSync } from "@/hooks/useNotificationSync";
import {
  getAllScheduledNotifications,
  ScheduledNotificationInfo,
} from "@/services/notifications";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
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

function getTypeIcon(type?: string): string {
  switch (type) {
    case "relative":
      return "clock-outline";
    case "absolute":
      return "clock-check-outline";
    case "day-wide":
      return "calendar-today";
    default:
      return "bell-outline";
  }
}

function getTimestampTypeIcon(timestampType?: string): string {
  switch (timestampType) {
    case "deadline":
      return "flag-outline";
    case "scheduled":
      return "calendar-clock";
    case "timestamp":
      return "calendar";
    default:
      return "";
  }
}

interface RelativeInfoParts {
  offset: string;
  timestampType: string;
  eventTime: string;
  isDayWide: boolean;
}

function getRelativeInfoParts(
  notification: ScheduledNotificationInfo,
): RelativeInfoParts | null {
  // Handle day-wide notifications
  if (notification.type === "day-wide") {
    const dateToUse = notification.eventTime || notification.scheduledTime;
    const dateStr = dateToUse.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return {
      offset: "",
      timestampType: notification.timestampType || "",
      eventTime: dateStr,
      isDayWide: true,
    };
  }

  // Handle relative notifications
  if (notification.minutesBefore === undefined || !notification.eventTime) {
    return null;
  }

  const mins = notification.minutesBefore;
  const offsetText =
    mins === 0
      ? "at"
      : mins < 60
        ? `${mins}m before`
        : `${Math.floor(mins / 60)}h${mins % 60 ? `${mins % 60}m` : ""} before`;

  return {
    offset: offsetText,
    timestampType: notification.timestampType || "event",
    eventTime: formatFullDateTime(notification.eventTime),
    isDayWide: false,
  };
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<
    ScheduledNotificationInfo[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { syncNotifications, isSyncing, syncError } = useNotificationSync();

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
      {syncError && (
        <Banner
          visible={true}
          icon="alert-circle"
          actions={[
            {
              label: "Retry",
              onPress: handleRefresh,
            },
          ]}
          style={{ backgroundColor: theme.colors.errorContainer }}
        >
          <Text style={{ color: theme.colors.onErrorContainer }}>
            Failed to sync notifications: {syncError}
          </Text>
        </Banner>
      )}
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
            Notifications will appear here when you have upcoming reminders
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {notifications.map((notification) => (
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
                  <View style={styles.typeRow}>
                    {notification.timestampType && (
                      <Chip
                        icon={() => (
                          <Icon
                            source={getTimestampTypeIcon(
                              notification.timestampType,
                            )}
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                        )}
                        compact
                        style={styles.chip}
                        textStyle={styles.chipText}
                      >
                        {notification.timestampType}
                      </Chip>
                    )}
                    {notification.type && (
                      <Chip
                        icon={() => (
                          <Icon
                            source={getTypeIcon(notification.type)}
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                          />
                        )}
                        compact
                        style={styles.chip}
                        textStyle={styles.chipText}
                      >
                        {notification.type}
                      </Chip>
                    )}
                  </View>
                  {(() => {
                    const parts = getRelativeInfoParts(notification);
                    if (!parts) return null;
                    if (parts.isDayWide) {
                      return (
                        <Text variant="bodySmall" style={{ marginTop: 4 }}>
                          <Text style={{ color: theme.colors.tertiary }}>
                            Day-wide
                          </Text>
                          {parts.timestampType && (
                            <Text style={{ color: theme.colors.outline }}>
                              {" "}
                              {parts.timestampType}
                            </Text>
                          )}
                          <Text style={{ color: theme.colors.outline }}>
                            {" "}
                            for{" "}
                          </Text>
                          <Text style={{ color: theme.colors.primary }}>
                            {parts.eventTime}
                          </Text>
                        </Text>
                      );
                    }
                    return (
                      <Text variant="bodySmall" style={{ marginTop: 4 }}>
                        <Text style={{ color: theme.colors.primary }}>
                          {parts.offset}
                        </Text>
                        <Text style={{ color: theme.colors.outline }}> </Text>
                        <Text style={{ color: theme.colors.tertiary }}>
                          {parts.timestampType}
                        </Text>
                        <Text style={{ color: theme.colors.outline }}>
                          {" "}
                          @ {parts.eventTime}
                        </Text>
                      </Text>
                    );
                  })()}
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
  typeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: 11,
    marginVertical: 0,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
});
