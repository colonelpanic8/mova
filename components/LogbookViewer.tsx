import { LogbookEntry } from "@/services/api";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, List, Text, useTheme } from "react-native-paper";

interface LogbookViewerProps {
  logbook: LogbookEntry[] | null | undefined;
  defaultExpanded?: boolean;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogbookEntryItem({ entry }: { entry: LogbookEntry }) {
  const theme = useTheme();

  if (entry.type === "state-change") {
    return (
      <View style={styles.entryRow}>
        <View style={styles.stateChangeRow}>
          {entry.fromState && (
            <>
              <Chip
                compact
                style={[
                  styles.stateChip,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
                textStyle={styles.stateChipText}
              >
                {entry.fromState}
              </Chip>
              <Text style={{ color: theme.colors.onSurfaceVariant }}> → </Text>
            </>
          )}
          <Chip
            compact
            style={[
              styles.stateChip,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            textStyle={[
              styles.stateChipText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {entry.toState}
          </Chip>
        </View>
        <Text
          variant="bodySmall"
          style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>
    );
  }

  if (entry.type === "note") {
    return (
      <View style={styles.entryRow}>
        <View style={styles.noteContainer}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Note
          </Text>
          <Text style={{ color: theme.colors.onSurface }}>{entry.note}</Text>
        </View>
        <Text
          variant="bodySmall"
          style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>
    );
  }

  if (entry.type === "clock") {
    return (
      <View style={styles.entryRow}>
        <View style={styles.clockContainer}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Clock: {entry.duration || "running"}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}
        >
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>
    );
  }

  return null;
}

export function LogbookViewer({
  logbook,
  defaultExpanded = false,
}: LogbookViewerProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const entries = logbook || [];

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <List.Accordion
        title="Logbook"
        description={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        left={(props) => <List.Icon {...props} icon="history" />}
        style={{ backgroundColor: theme.colors.surface }}
      >
        {entries.map((entry, index) => (
          <LogbookEntryItem key={`${entry.timestamp}-${index}`} entry={entry} />
        ))}
      </List.Accordion>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  entryRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  stateChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  stateChip: {
    height: 24,
  },
  stateChipText: {
    fontSize: 11,
    marginVertical: 0,
    marginHorizontal: 4,
  },
  timestamp: {
    fontFamily: "monospace",
    fontSize: 11,
  },
  noteContainer: {
    marginBottom: 4,
  },
  clockContainer: {
    marginBottom: 4,
  },
});
