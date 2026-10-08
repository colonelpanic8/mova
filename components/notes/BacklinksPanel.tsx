import type { NoteBacklink, NoteSummary } from "@/services/api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { NoteBlocks, useOpenNote } from "./NoteContent";
import { notePath } from "./NoteRow";

function Section({
  title,
  count,
  initiallyOpen,
  children,
}: {
  title: string;
  count: number;
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  if (count === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        style={[
          styles.sectionHeader,
          { borderBottomColor: theme.colors.outlineVariant },
        ]}
        onPress={() => setOpen((value) => !value)}
      >
        <MaterialCommunityIcons
          name={open ? "chevron-down" : "chevron-right"}
          size={20}
          color={theme.colors.outline}
        />
        <Text variant="titleSmall">
          {title} ({count})
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}

function SourceTitle({ note }: { note: NoteSummary }) {
  const theme = useTheme();
  const openNote = useOpenNote();
  return (
    <Pressable onPress={() => openNote(note.ref)}>
      <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
        {note.title}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.outline }}
        numberOfLines={1}
      >
        {notePath(note)}
      </Text>
    </Pressable>
  );
}

function Backlink({ backlink }: { backlink: NoteBacklink }) {
  const theme = useTheme();
  return (
    <View style={styles.entry}>
      <SourceTitle note={backlink} />
      {backlink.occurrences ? (
        backlink.occurrences.map((occurrence, index) => (
          <View
            key={index}
            style={[
              styles.preview,
              { borderLeftColor: theme.colors.outlineVariant },
            ]}
          >
            {occurrence.olp.length > 0 && (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.outline }}
              >
                {occurrence.olp.join(" › ")}
              </Text>
            )}
            <NoteBlocks blocks={occurrence.preview} />
          </View>
        ))
      ) : backlink.context ? (
        <Text variant="bodySmall" style={styles.context}>
          {backlink.context}
        </Text>
      ) : null}
    </View>
  );
}

interface BacklinksPanelProps {
  backlinks: NoteBacklink[];
  unlinked?: NoteSummary[];
  links: NoteSummary[];
}

/** Connections of a note, laid out like org-roam's backlinks buffer. */
export function BacklinksPanel({
  backlinks,
  unlinked = [],
  links,
}: BacklinksPanelProps) {
  return (
    <View>
      <Section title="Backlinks" count={backlinks.length} initiallyOpen>
        {backlinks.map((backlink) => (
          <Backlink key={backlink.ref} backlink={backlink} />
        ))}
      </Section>
      <Section
        title="Unlinked references"
        count={unlinked.length}
        initiallyOpen={false}
      >
        {unlinked.map((note) => (
          <View key={note.ref} style={styles.entry}>
            <SourceTitle note={note} />
            {note.context ? (
              <Text variant="bodySmall" style={styles.context}>
                {note.context}
              </Text>
            ) : null}
          </View>
        ))}
      </Section>
      <Section title="Links to" count={links.length} initiallyOpen={false}>
        {links.map((note) => (
          <View key={note.ref} style={styles.entry}>
            <SourceTitle note={note} />
          </View>
        ))}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entry: {
    paddingVertical: 10,
    paddingLeft: 8,
  },
  preview: {
    marginTop: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
  context: {
    marginTop: 4,
    opacity: 0.85,
  },
});
