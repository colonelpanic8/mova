import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Divider,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

export interface TagsEditorHandle {
  /**
   * Commit any tag text typed but not yet added and return the resulting
   * tags. Lets submit handlers pick up a half-entered tag synchronously.
   */
  flush: () => string[];
}

interface TagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  defaultExpanded?: boolean;
  title?: string;
}

export const TagsEditor = forwardRef<TagsEditorHandle, TagsEditorProps>(
  function TagsEditor(
    { tags, onChange, defaultExpanded = false, title = "Tags" },
    ref,
  ) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [newTag, setNewTag] = useState("");

    const handleAddTag = (): string[] => {
      const trimmedTag = newTag.trim();
      if (!trimmedTag) return tags;
      setNewTag("");
      // Avoid duplicates
      if (tags.includes(trimmedTag)) return tags;
      const next = [...tags, trimmedTag];
      onChange(next);
      return next;
    };

    useImperativeHandle(ref, () => ({ flush: handleAddTag }));

    const handleRemoveTag = (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    };

    return (
      <View style={styles.container}>
        <List.Accordion
          title={title}
          description={tags.length > 0 ? `${tags.length} tags` : undefined}
          expanded={expanded}
          onPress={() => setExpanded(!expanded)}
          left={(props) => <List.Icon {...props} icon="tag-outline" />}
          style={{ backgroundColor: theme.colors.surface }}
        >
          {tags.length === 0 ? (
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No tags
            </Text>
          ) : (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <Chip
                  key={`${tag}-${index}`}
                  onClose={() => handleRemoveTag(index)}
                  style={styles.tag}
                >
                  {tag}
                </Chip>
              ))}
            </View>
          )}

          <Divider style={styles.divider} />

          <View style={styles.addSection}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
            >
              Add Tag
            </Text>
            <View style={styles.addRow}>
              <TextInput
                placeholder="Tag name"
                value={newTag}
                onChangeText={setNewTag}
                mode="outlined"
                dense
                style={styles.tagInput}
                onSubmitEditing={handleAddTag}
              />
              <Button
                mode="contained-tonal"
                onPress={handleAddTag}
                disabled={!newTag.trim()}
                compact
              >
                Add
              </Button>
            </View>
          </View>
        </List.Accordion>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontStyle: "italic",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tag: {
    marginBottom: 0,
  },
  divider: {
    marginVertical: 12,
  },
  addSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagInput: {
    flex: 1,
  },
});
