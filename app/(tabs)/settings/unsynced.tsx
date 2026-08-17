import { formatQueuedAt } from "@/components/capture/PendingCapturesCard";
import { useOutbox } from "@/context/OutboxContext";
import { getOutboxEntryTitle, OutboxEntry } from "@/services/captureOutbox";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  Divider,
  Icon,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

export default function UnsyncedScreen() {
  const theme = useTheme();
  const { pendingEntries, flushNow, discardEntry } = useOutbox();
  const [confirming, setConfirming] = useState<OutboxEntry | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const confirmDiscard = async () => {
    if (!confirming) return;
    setDiscarding(true);
    try {
      await discardEntry(confirming.id);
      setConfirming(null);
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }}>
      {pendingEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon
            source="cloud-check-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Everything is synced
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            Captures that cannot reach the server are kept here until they are
            delivered or you discard them.
          </Text>
        </View>
      ) : (
        <List.Section>
          <Text
            variant="bodyMedium"
            style={[
              styles.description,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            These captures are saved on this device and retried automatically.
            Discarding one deletes it permanently.
          </Text>
          <View style={styles.actions}>
            <Button
              mode="contained-tonal"
              icon="refresh"
              onPress={() => {
                void flushNow();
              }}
              testID="unsyncedRetryAll"
            >
              Retry all
            </Button>
          </View>
          <Divider />
          {pendingEntries.map((entry) => (
            <List.Item
              key={entry.id}
              title={getOutboxEntryTitle(entry)}
              description={[
                formatQueuedAt(entry.createdAt),
                entry.retryCount > 0
                  ? `${entry.retryCount} ${
                      entry.retryCount === 1 ? "attempt" : "attempts"
                    }`
                  : null,
                entry.lastError ? `Last error: ${entry.lastError}` : null,
              ]
                .filter(Boolean)
                .join("\n")}
              descriptionNumberOfLines={3}
              left={(props) => (
                <List.Icon {...props} icon="cloud-upload-outline" />
              )}
              right={() => (
                <Button
                  compact
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={() => setConfirming(entry)}
                  testID={`discardPendingCapture-${entry.id}`}
                  accessibilityLabel={`Discard capture "${getOutboxEntryTitle(entry)}"`}
                >
                  Discard
                </Button>
              )}
            />
          ))}
        </List.Section>
      )}

      <Portal>
        <Dialog visible={!!confirming} onDismiss={() => setConfirming(null)}>
          <Dialog.Title>Discard capture?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              “{confirming ? getOutboxEntryTitle(confirming) : ""}” has not
              reached the server and will be permanently deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(null)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              loading={discarding}
              disabled={discarding}
              onPress={() => {
                void confirmDiscard();
              }}
              testID="confirmDiscardPendingCapture"
            >
              Discard
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  description: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 96,
  },
  emptyText: {
    textAlign: "center",
  },
});
