import {
  getAllScheduledNotifications,
  ScheduledNotificationInfo,
} from "@/services/notifications";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

interface ScheduledNotificationsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ScheduledNotificationsModal({
  visible,
  onDismiss,
}: ScheduledNotificationsModalProps) {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<
    ScheduledNotificationInfo[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      getAllScheduledNotifications().then(
        (notifs: ScheduledNotificationInfo[]) => {
          setNotifications(notifs);
          setLoading(false);
        },
      );
    }
  }, [visible]);

  const formatTriggerDate = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Any moment";
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
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatReason = (item: ScheduledNotificationInfo): string => {
    if (item.offsetMinutes === undefined) {
      return ""; // Legacy notification without new data
    }
    const offsetText =
      item.offsetMinutes === 0
        ? "at event time"
        : item.offsetMinutes < 60
          ? `${item.offsetMinutes} min before`
          : `${Math.floor(item.offsetMinutes / 60)}h ${item.offsetMinutes % 60 ? `${item.offsetMinutes % 60}m ` : ""}before`;
    const typeText = item.isCustom ? "custom" : "default";
    return `${offsetText} (${typeText})`;
  };

  const renderNotification = ({
    item,
  }: {
    item: ScheduledNotificationInfo;
  }) => {
    const reason = formatReason(item);
    return (
      <View style={styles.notificationItem}>
        <View style={styles.notificationHeader}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={[
              styles.notificationTitle,
              { color: theme.colors.onSurface },
            ]}
          >
            {item.title}
          </Text>
          <Text
            variant="labelSmall"
            style={[styles.timeUntil, { color: theme.colors.primary }]}
          >
            {formatTriggerDate(item.scheduledTime)}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={[styles.triggerTime, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatTime(item.scheduledTime)}
        </Text>
        {reason && (
          <Text
            variant="labelSmall"
            style={[styles.reason, { color: theme.colors.outline }]}
          >
            {reason}
          </Text>
        )}
        {item.eventTime && (
          <Text
            variant="labelSmall"
            style={[styles.eventTime, { color: theme.colors.tertiary }]}
          >
            Event: {formatTime(item.eventTime)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text variant="titleLarge" style={styles.title}>
          Scheduled Notifications
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No scheduled notifications
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.identifier}
            renderItem={renderNotification}
            ItemSeparatorComponent={() => <Divider />}
            style={styles.list}
          />
        )}

        <Button mode="text" onPress={onDismiss} style={styles.closeButton}>
          Close
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: "80%",
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
  },
  list: {
    maxHeight: 400,
  },
  notificationItem: {
    paddingVertical: 12,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
  },
  timeUntil: {
    fontWeight: "600",
  },
  triggerTime: {
    marginTop: 2,
  },
  reason: {
    marginTop: 4,
  },
  eventTime: {
    marginTop: 2,
  },
  closeButton: {
    marginTop: 16,
  },
});
