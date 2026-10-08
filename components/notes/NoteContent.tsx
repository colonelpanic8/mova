import { useColorPalette } from "@/context/ColorPaletteContext";
import type {
  NoteBlock,
  NoteContent as NoteContentData,
  NoteHeading,
  NoteInline,
} from "@/services/api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
} from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

const EXTERNAL_LINK = /^(https?|mailto):/i;

type OpenNote = (ref: string) => void;

const OpenNoteContext = createContext<OpenNote | null>(null);
const ExpandedContext = createContext(true);

/**
 * Overrides what opening a note does for the notes rendered inside, e.g. to
 * preview it in place instead of pushing the note screen.
 */
export function NoteNavigationProvider({
  onOpenNote,
  children,
}: {
  onOpenNote: OpenNote;
  children: ReactNode;
}) {
  return (
    <OpenNoteContext.Provider value={onOpenNote}>
      {children}
    </OpenNoteContext.Provider>
  );
}

export function useOpenNote(): OpenNote {
  const router = useRouter();
  const override = useContext(OpenNoteContext);
  const push = useCallback(
    (ref: string) => router.push({ pathname: "/note", params: { ref } }),
    [router],
  );
  return override ?? push;
}

function useOpenLink() {
  const openNote = useOpenNote();
  return useCallback(
    ({ href, ref }: { href: string; ref: string | null }) => {
      if (ref) {
        openNote(ref);
      } else if (EXTERNAL_LINK.test(href)) {
        void Linking.openURL(href);
      }
    },
    [openNote],
  );
}

export function countHeadings(content: NoteContentData): number {
  return content.children.reduce(
    (total, child) => total + 1 + countHeadings(child),
    0,
  );
}

export function inlineText(inlines: NoteInline[]): string {
  return inlines
    .map((inline) => ("v" in inline ? inline.v : inlineText(inline.c)))
    .join("");
}

function Inlines({ inlines }: { inlines: NoteInline[] }) {
  const theme = useTheme();
  const openLink = useOpenLink();

  return inlines.map((inline, index) => {
    switch (inline.t) {
      case "text":
        return <Fragment key={index}>{inline.v}</Fragment>;
      case "code":
        return (
          <Text
            key={index}
            style={[
              styles.code,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            {inline.v}
          </Text>
        );
      case "timestamp":
        return (
          <Text key={index} style={{ color: theme.colors.outline }}>
            {inline.v}
          </Text>
        );
      case "link": {
        const navigable =
          inline.ref !== null || EXTERNAL_LINK.test(inline.href);
        return (
          <Text
            key={index}
            style={
              navigable
                ? { color: theme.colors.primary }
                : { textDecorationLine: "underline" }
            }
            onPress={navigable ? () => openLink(inline) : undefined}
          >
            <Inlines inlines={inline.c} />
          </Text>
        );
      }
      default:
        return (
          <Text key={index} style={EMPHASIS_STYLES[inline.t]}>
            <Inlines inlines={inline.c} />
          </Text>
        );
    }
  });
}

const EMPHASIS_STYLES: Record<
  "bold" | "italic" | "underline" | "strike-through",
  TextStyle
> = {
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  "strike-through": { textDecorationLine: "line-through" },
};

function Paragraph({ inlines }: { inlines: NoteInline[] }) {
  return (
    <Text variant="bodyMedium" style={styles.paragraph} selectable>
      <Inlines inlines={inlines} />
    </Text>
  );
}

function Preformatted({ value }: { value: string }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      style={[
        styles.preformatted,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <Text style={styles.monospace} selectable>
        {value}
      </Text>
    </ScrollView>
  );
}

function ListBlock({ block }: { block: Extract<NoteBlock, { type: "list" }> }) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {block.items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <View style={styles.bullet}>
            {item.checkbox ? (
              <MaterialCommunityIcons
                name={
                  item.checkbox === "on"
                    ? "checkbox-marked-outline"
                    : item.checkbox === "trans"
                      ? "minus-box-outline"
                      : "checkbox-blank-outline"
                }
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            ) : (
              <Text variant="bodyMedium">
                {block.ordered ? `${index + 1}.` : "•"}
              </Text>
            )}
          </View>
          <View style={styles.listItemBody}>
            {item.tag && (
              <Text variant="bodyMedium" style={styles.bold}>
                <Inlines inlines={item.tag} />
              </Text>
            )}
            <Blocks blocks={item.blocks} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TableBlock({
  block,
}: {
  block: Extract<NoteBlock, { type: "table" }>;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal style={styles.table}>
      <View
        style={{ borderColor: theme.colors.outlineVariant, borderWidth: 1 }}
      >
        {block.rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <View
                key={cellIndex}
                style={[
                  styles.tableCell,
                  { borderColor: theme.colors.outlineVariant },
                  block.header &&
                    rowIndex === 0 && {
                      backgroundColor: theme.colors.surfaceVariant,
                    },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={
                    block.header && rowIndex === 0 ? styles.bold : undefined
                  }
                  selectable
                >
                  <Inlines inlines={cell} />
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Block({ block }: { block: NoteBlock }) {
  const theme = useTheme();
  switch (block.type) {
    case "paragraph":
      return <Paragraph inlines={block.content} />;
    case "verse":
      return (
        <Text
          variant="bodyMedium"
          style={[styles.paragraph, styles.italic]}
          selectable
        >
          <Inlines inlines={block.content} />
        </Text>
      );
    case "list":
      return <ListBlock block={block} />;
    case "src":
    case "example":
      return <Preformatted value={block.value} />;
    case "quote":
      return (
        <View style={[styles.quote, { borderLeftColor: theme.colors.outline }]}>
          <Blocks blocks={block.blocks} />
        </View>
      );
    case "table":
      return <TableBlock block={block} />;
    case "rule":
      return (
        <View
          style={[
            styles.rule,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />
      );
    case "planning":
      return (
        <Text
          variant="bodySmall"
          style={[styles.paragraph, { color: theme.colors.outline }]}
        >
          {block.text}
        </Text>
      );
    case "footnote":
      return (
        <View style={styles.footnote}>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            [{block.label}]
          </Text>
          <View style={styles.listItemBody}>
            <Blocks blocks={block.blocks} />
          </View>
        </View>
      );
  }
}

function Blocks({ blocks }: { blocks: NoteBlock[] }) {
  return blocks.map((block, index) => <Block key={index} block={block} />);
}

const HEADING_VARIANTS = ["titleMedium", "titleSmall", "bodyLarge"] as const;

function Heading({ heading, depth }: { heading: NoteHeading; depth: number }) {
  const theme = useTheme();
  const defaultExpanded = useContext(ExpandedContext);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { getTodoStateColor } = useColorPalette();
  const openNote = useOpenNote();
  const hasBody = heading.blocks.length > 0 || heading.children.length > 0;

  return (
    <View style={[styles.heading, depth > 0 && styles.nested]}>
      <View style={styles.headingRow}>
        <Pressable
          style={styles.headingTitle}
          onPress={hasBody ? () => setExpanded((value) => !value) : undefined}
        >
          <MaterialCommunityIcons
            name={
              hasBody
                ? expanded
                  ? "chevron-down"
                  : "chevron-right"
                : "circle-small"
            }
            size={20}
            color={theme.colors.outline}
            style={styles.chevron}
          />
          <Text
            variant={
              HEADING_VARIANTS[Math.min(depth, HEADING_VARIANTS.length - 1)]
            }
            style={styles.headingText}
          >
            {heading.todo && (
              <Text
                style={{
                  color: getTodoStateColor(heading.todo),
                  fontWeight: "bold",
                }}
              >
                {heading.todo}{" "}
              </Text>
            )}
            {heading.priority && (
              <Text style={{ color: theme.colors.outline }}>
                [#{heading.priority}]{" "}
              </Text>
            )}
            <Inlines inlines={heading.title} />
            {heading.tags.length > 0 && (
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {"  "}:{heading.tags.join(":")}:
              </Text>
            )}
          </Text>
        </Pressable>
        {heading.ref && (
          <IconButton
            icon="open-in-new"
            size={16}
            style={styles.openButton}
            onPress={() => openNote(heading.ref!)}
            accessibilityLabel="Open as note"
          />
        )}
      </View>
      {expanded && (
        <View style={styles.headingBody}>
          <Blocks blocks={heading.blocks} />
          {heading.children.map((child, index) => (
            <Heading key={index} heading={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

interface NoteContentProps {
  content: NoteContentData;
  /** Whether headings start expanded; remount (change key) to reapply. */
  defaultExpanded: boolean;
}

export function NoteContent({ content, defaultExpanded }: NoteContentProps) {
  return (
    <ExpandedContext.Provider value={defaultExpanded}>
      <Blocks blocks={content.blocks} />
      {content.children.map((child, index) => (
        <Heading key={index} heading={child} depth={0} />
      ))}
    </ExpandedContext.Provider>
  );
}

export function NoteBlocks({ blocks }: { blocks: NoteBlock[] }) {
  return <Blocks blocks={blocks} />;
}

const styles = StyleSheet.create({
  paragraph: {
    marginVertical: 4,
    lineHeight: 21,
  },
  bold: {
    fontWeight: "bold",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  monospace: {
    fontFamily: "monospace",
    fontSize: 12,
  },
  preformatted: {
    marginVertical: 6,
    padding: 8,
    borderRadius: 6,
  },
  list: {
    marginVertical: 2,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet: {
    minWidth: 22,
    paddingTop: 5,
  },
  listItemBody: {
    flex: 1,
  },
  table: {
    marginVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCell: {
    minWidth: 60,
    maxWidth: 240,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginVertical: 4,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  footnote: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 2,
  },
  heading: {
    marginTop: 6,
  },
  nested: {
    marginLeft: 8,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headingTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  chevron: {
    marginTop: 1,
  },
  headingText: {
    flex: 1,
  },
  openButton: {
    margin: 0,
  },
  headingBody: {
    paddingLeft: 20,
  },
});
