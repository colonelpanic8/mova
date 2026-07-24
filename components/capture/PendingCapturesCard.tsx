import {
  getOutboxEntryTitle,
  type OutboxEntry,
} from "@/services/captureOutbox";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Surface, Text, useTheme } from "react-native-paper";

const MAX_VISIBLE_ENTRIES = 5;

function formatQueuedAt(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "Queued";

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60_000),
  );
  if (elapsedMinutes < 1) return "Queued just now";
  if (elapsedMinutes < 60) return `Queued ${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Queued ${elapsedHours}h ago`;

  return `Queued ${Math.floor(elapsedHours / 24)}d ago`;
}

interface PendingCapturesCardProps {
  entries: OutboxEntry[];
  onRetry: () => void;
}

export function PendingCapturesCard({
  entries,
  onRetry,
}: PendingCapturesCardProps) {
  const theme = useTheme();

  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, MAX_VISIBLE_ENTRIES);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <Surface
      elevation={0}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.secondaryContainer,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      testID="pendingCapturesCard"
    >
      <View style={styles.header}>
        <Icon
          source="cloud-upload-outline"
          size={24}
          color={theme.colors.onSecondaryContainer}
        />
        <View style={styles.heading}>
          <Text
            variant="titleSmall"
            style={{ color: theme.colors.onSecondaryContainer }}
          >
            Pending captures
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSecondaryContainer }}
          >
            Saved on this device until they can be delivered
          </Text>
        </View>
        <Button
          compact
          mode="text"
          onPress={onRetry}
          testID="retryPendingCaptures"
          accessibilityLabel={`Retry ${entries.length} pending capture${
            entries.length === 1 ? "" : "s"
          }`}
        >
          Retry
        </Button>
      </View>

      <View style={styles.entries}>
        {visibleEntries.map((entry) => (
          <View
            key={entry.id}
            style={[
              styles.entry,
              { borderTopColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.entryText}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                {getOutboxEntryTitle(entry)}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                {formatQueuedAt(entry.createdAt)}
                {entry.retryCount > 0
                  ? ` · ${entry.retryCount} ${
                      entry.retryCount === 1 ? "retry" : "retries"
                    }`
                  : ""}
              </Text>
            </View>
          </View>
        ))}
        {hiddenCount > 0 && (
          <Text
            variant="labelMedium"
            style={[
              styles.moreText,
              {
                borderTopColor: theme.colors.outlineVariant,
                color: theme.colors.onSecondaryContainer,
              },
            ]}
          >
            +{hiddenCount} more
          </Text>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heading: {
    flex: 1,
  },
  entries: {
    paddingHorizontal: 12,
  },
  entry: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: 9,
  },
  entryText: {
    flex: 1,
  },
  moreText: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    textAlign: "center",
  },
});
