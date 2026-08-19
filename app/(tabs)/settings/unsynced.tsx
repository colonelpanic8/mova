import { formatQueuedAt } from "@/components/capture/PendingCapturesCard";
import { useOutbox } from "@/context/OutboxContext";
import { getOutboxEntryTitle, OutboxEntry } from "@/services/captureOutbox";
import {
  buildIssueUrl,
  formatOutboxEntryForExport,
} from "@/services/outboxExport";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  Divider,
  Icon,
  List,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";

/**
 * Hand the capture to the OS share sheet so it can be sent anywhere -- to a
 * desktop over KDE Connect, to email, to another app. Web has no share sheet
 * on every browser, so fall back to the clipboard there.
 */
async function shareEntry(entry: OutboxEntry): Promise<void> {
  const message = formatOutboxEntryForExport(entry);
  const title = getOutboxEntryTitle(entry);

  if (Platform.OS === "web") {
    const nav = globalThis.navigator as
      | (Navigator & {
          share?: (data: { title: string; text: string }) => Promise<void>;
        })
      | undefined;
    if (nav?.share) {
      await nav.share({ title, text: message });
      return;
    }
    await nav?.clipboard?.writeText(message);
    return;
  }

  await Share.share({ message, title });
}

export default function UnsyncedScreen() {
  const theme = useTheme();
  const { pendingEntries, flushNow, discardEntry } = useOutbox();
  const [confirming, setConfirming] = useState<OutboxEntry | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [entryAction, setEntryAction] = useState<{
    entryId: string;
    kind: "share" | "report";
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const appVersion = Constants.expoConfig?.version;

  const confirmDiscard = async () => {
    if (!confirming) return;
    setDiscarding(true);
    try {
      await discardEntry(confirming.id);
      setConfirming(null);
      setFeedback({ message: "Capture discarded", isError: false });
    } catch {
      setFeedback({ message: "Could not discard capture", isError: true });
    } finally {
      setDiscarding(false);
    }
  };

  const retryAll = async () => {
    setRetrying(true);
    setFeedback({
      message: `Retrying ${pendingEntries.length} capture${pendingEntries.length === 1 ? "" : "s"}…`,
      isError: false,
    });
    try {
      const result = await flushNow();
      if (!result) {
        setFeedback({ message: "Could not retry captures", isError: true });
      } else if (result.remaining === 0) {
        setFeedback({ message: "All captures synced", isError: false });
      } else {
        setFeedback({
          message: `${result.succeededCount} synced · ${result.remaining} still queued`,
          isError: result.succeededCount === 0,
        });
      }
    } catch {
      setFeedback({ message: "Could not retry captures", isError: true });
    } finally {
      setRetrying(false);
    }
  };

  const share = async (entry: OutboxEntry) => {
    setEntryAction({ entryId: entry.id, kind: "share" });
    setFeedback({ message: "Opening share sheet…", isError: false });
    try {
      await shareEntry(entry);
      setFeedback({ message: "Share action finished", isError: false });
    } catch {
      setFeedback({ message: "Could not open share sheet", isError: true });
    } finally {
      setEntryAction(null);
    }
  };

  const report = async (entry: OutboxEntry) => {
    setEntryAction({ entryId: entry.id, kind: "report" });
    setFeedback({ message: "Opening GitHub issue…", isError: false });
    try {
      await Linking.openURL(buildIssueUrl(entry, { appVersion }));
      setFeedback({ message: "GitHub issue opened", isError: false });
    } catch {
      setFeedback({ message: "Could not open GitHub", isError: true });
    } finally {
      setEntryAction(null);
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
            Retry all attempts every capture independently. Temporary network or
            server failures stay here for another retry. Discarding one deletes
            it permanently.
          </Text>
          <View style={styles.actions}>
            <Button
              mode="contained-tonal"
              icon="refresh"
              onPress={() => {
                void retryAll();
              }}
              loading={retrying}
              disabled={retrying || entryAction !== null}
              testID="unsyncedRetryAll"
            >
              Retry all
            </Button>
          </View>
          <Divider />
          {pendingEntries.map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.entry,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <List.Item
                title={getOutboxEntryTitle(entry)}
                titleNumberOfLines={2}
                description={[
                  formatQueuedAt(entry.createdAt),
                  entry.retryCount > 0
                    ? `${entry.retryCount} ${
                        entry.retryCount === 1 ? "attempt" : "attempts"
                      }`
                    : "Not attempted yet",
                  entry.lastError ? `Last error: ${entry.lastError}` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
                descriptionNumberOfLines={4}
                left={(props) => (
                  <List.Icon {...props} icon="cloud-upload-outline" />
                )}
              />
              <View style={styles.entryActions}>
                <Button
                  compact
                  mode="text"
                  icon="share-variant"
                  onPress={() => {
                    void share(entry);
                  }}
                  loading={
                    entryAction?.entryId === entry.id &&
                    entryAction.kind === "share"
                  }
                  disabled={retrying || entryAction !== null}
                  testID={`sharePendingCapture-${entry.id}`}
                  accessibilityLabel={`Share capture "${getOutboxEntryTitle(entry)}"`}
                >
                  Share
                </Button>
                <Button
                  compact
                  mode="text"
                  icon="github"
                  onPress={() => {
                    void report(entry);
                  }}
                  loading={
                    entryAction?.entryId === entry.id &&
                    entryAction.kind === "report"
                  }
                  disabled={retrying || entryAction !== null}
                  testID={`reportPendingCapture-${entry.id}`}
                  accessibilityLabel={`Report capture "${getOutboxEntryTitle(entry)}" on GitHub`}
                >
                  Report
                </Button>
                <Button
                  compact
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={() => setConfirming(entry)}
                  disabled={retrying || entryAction !== null}
                  testID={`discardPendingCapture-${entry.id}`}
                  accessibilityLabel={`Discard capture "${getOutboxEntryTitle(entry)}"`}
                >
                  Discard
                </Button>
              </View>
            </View>
          ))}
        </List.Section>
      )}

      <Portal>
        <Dialog
          visible={!!confirming}
          onDismiss={() => {
            if (!discarding) setConfirming(null);
          }}
        >
          <Dialog.Title>Discard capture?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              “{confirming ? getOutboxEntryTitle(confirming) : ""}” has not
              reached the server and will be permanently deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={discarding} onPress={() => setConfirming(null)}>
              Cancel
            </Button>
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
        <Snackbar
          visible={feedback !== null}
          onDismiss={() => setFeedback(null)}
          duration={4000}
          action={{ label: "Dismiss", onPress: () => setFeedback(null) }}
          style={
            feedback?.isError
              ? { backgroundColor: theme.colors.errorContainer }
              : undefined
          }
          testID="unsyncedFeedback"
        >
          <Text
            style={
              feedback?.isError
                ? { color: theme.colors.onErrorContainer }
                : undefined
            }
          >
            {feedback?.message ?? ""}
          </Text>
        </Snackbar>
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
  entryActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  entry: {
    borderBottomWidth: StyleSheet.hairlineWidth,
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
