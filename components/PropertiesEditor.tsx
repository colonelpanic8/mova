import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Divider,
  IconButton,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface PropertiesEditorProps {
  properties: Record<string, string>;
  onChange: (properties: Record<string, string>) => void;
  defaultExpanded?: boolean;
}

export function PropertiesEditor({
  properties,
  onChange,
  defaultExpanded = false,
}: PropertiesEditorProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const entries = Object.entries(properties);

  const handleAddProperty = () => {
    const trimmedKey = newKey.trim().toUpperCase();
    if (!trimmedKey) return;

    onChange({
      ...properties,
      [trimmedKey]: newValue,
    });
    setNewKey("");
    setNewValue("");
  };

  const handleRemoveProperty = (key: string) => {
    const updated = { ...properties };
    delete updated[key];
    onChange(updated);
  };

  const handleStartEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSaveEdit = (key: string) => {
    onChange({
      ...properties,
      [key]: editValue,
    });
    setEditingKey(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <View style={styles.container}>
      <List.Accordion
        title="Properties"
        description={
          entries.length > 0 ? `${entries.length} properties` : undefined
        }
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        left={(props) => <List.Icon {...props} icon="tag-multiple" />}
        style={{ backgroundColor: theme.colors.surface }}
      >
        {entries.length === 0 ? (
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No properties defined
          </Text>
        ) : (
          entries.map(([key, value]) => (
            <View key={key} style={styles.propertyRow}>
              <View style={styles.propertyContent}>
                <Text
                  style={[styles.propertyKey, { color: theme.colors.primary }]}
                >
                  :{key}:
                </Text>
                {editingKey === key ? (
                  <View style={styles.editRow}>
                    <TextInput
                      value={editValue}
                      onChangeText={setEditValue}
                      mode="outlined"
                      dense
                      style={styles.editInput}
                      autoFocus
                      onSubmitEditing={() => handleSaveEdit(key)}
                    />
                    <IconButton
                      icon="check"
                      size={20}
                      onPress={() => handleSaveEdit(key)}
                    />
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={handleCancelEdit}
                    />
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.propertyValue,
                      { color: theme.colors.onSurface },
                    ]}
                    onPress={() => handleStartEdit(key, value)}
                  >
                    {value || "(empty)"}
                  </Text>
                )}
              </View>
              {editingKey !== key && (
                <IconButton
                  icon="delete-outline"
                  size={20}
                  onPress={() => handleRemoveProperty(key)}
                  iconColor={theme.colors.error}
                />
              )}
            </View>
          ))
        )}

        <Divider style={styles.divider} />

        <View style={styles.addSection}>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            Add Property
          </Text>
          <View style={styles.addRow}>
            <TextInput
              placeholder="KEY"
              value={newKey}
              onChangeText={setNewKey}
              mode="outlined"
              dense
              style={styles.keyInput}
              autoCapitalize="characters"
            />
            <TextInput
              placeholder="Value"
              value={newValue}
              onChangeText={setNewValue}
              mode="outlined"
              dense
              style={styles.valueInput}
              onSubmitEditing={handleAddProperty}
            />
            <Button
              mode="contained-tonal"
              onPress={handleAddProperty}
              disabled={!newKey.trim()}
              compact
            >
              Add
            </Button>
          </View>
        </View>
      </List.Accordion>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontStyle: "italic",
  },
  propertyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  propertyContent: {
    flex: 1,
  },
  propertyKey: {
    fontFamily: "monospace",
    fontWeight: "600",
    fontSize: 13,
  },
  propertyValue: {
    marginTop: 2,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  editInput: {
    flex: 1,
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
  keyInput: {
    flex: 0.4,
  },
  valueInput: {
    flex: 0.6,
  },
});
