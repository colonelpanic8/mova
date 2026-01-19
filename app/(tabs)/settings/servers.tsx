import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/context/AuthContext";
import { SavedServer, SavedServerInput } from "@/types/server";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  List,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type EditingServer = SavedServer | ({ id: null } & SavedServerInput);

export default function ServersScreen() {
  const theme = useTheme();
  const {
    savedServers,
    activeServerId,
    switchServer,
    updateServer,
    deleteServer,
  } = useAuth();

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<EditingServer | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const handleServerPress = async (server: SavedServer) => {
    if (server.id === activeServerId) return;

    setSwitchingId(server.id);
    try {
      const success = await switchServer(server.id);
      if (!success) {
        Alert.alert(
          "Connection Failed",
          "Could not connect to the server. Check your credentials.",
        );
      }
    } catch {
      Alert.alert("Error", "Failed to switch servers");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleEdit = (server: SavedServer) => {
    setEditingServer({ ...server });
    setEditDialogVisible(true);
  };

  const handleDelete = (server: SavedServer) => {
    Alert.alert(
      "Delete Server",
      `Are you sure you want to delete "${server.nickname || server.apiUrl}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteServer(server.id);
          },
        },
      ],
    );
  };

  const handleSaveEdit = async () => {
    if (!editingServer) return;

    setSaving(true);
    try {
      if (editingServer.id) {
        await updateServer(editingServer.id, {
          nickname: editingServer.nickname,
          apiUrl: editingServer.apiUrl,
          username: editingServer.username,
          password: editingServer.password,
        });
      }
      setEditDialogVisible(false);
      setEditingServer(null);
    } catch {
      Alert.alert("Error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const renderServerItem = (server: SavedServer) => {
    const isActive = server.id === activeServerId;
    const isSwitching = switchingId === server.id;

    return (
      <Surface key={server.id} style={styles.serverCard} elevation={1}>
        <Pressable
          onPress={() => handleServerPress(server)}
          onLongPress={() => handleEdit(server)}
          disabled={isSwitching}
          style={({ pressed }) => [
            styles.serverContent,
            pressed && { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <View style={styles.serverInfo}>
            <View style={styles.serverHeader}>
              <Text
                variant="titleMedium"
                numberOfLines={1}
                style={styles.serverName}
              >
                {server.nickname || server.apiUrl}
              </Text>
              {isActive && (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.activeBadge,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  Active
                </Text>
              )}
            </View>
            <Text variant="bodySmall" style={styles.serverDetail}>
              {server.username}
            </Text>
            {server.nickname && (
              <Text
                variant="bodySmall"
                style={styles.serverDetail}
                numberOfLines={1}
              >
                {server.apiUrl}
              </Text>
            )}
          </View>
          {isSwitching ? (
            <ActivityIndicator size="small" />
          ) : (
            <View style={styles.serverActions}>
              <Pressable onPress={() => handleEdit(server)} hitSlop={8}>
                <List.Icon icon="pencil" />
              </Pressable>
              <Pressable onPress={() => handleDelete(server)} hitSlop={8}>
                <List.Icon icon="delete" color={theme.colors.error} />
              </Pressable>
            </View>
          )}
        </Pressable>
      </Surface>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {savedServers.length === 0 ? (
          <View style={styles.emptyState}>
            <List.Icon icon="server-off" />
            <Text variant="bodyLarge" style={styles.emptyText}>
              No saved servers
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Servers you connect to will appear here
            </Text>
          </View>
        ) : (
          savedServers.map(renderServerItem)
        )}
      </ScrollView>

      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
        >
          <Dialog.Title>Edit Server</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <TextInput
                label="Nickname (optional)"
                value={editingServer?.nickname || ""}
                onChangeText={(text) =>
                  setEditingServer(
                    (prev) => prev && { ...prev, nickname: text || undefined },
                  )
                }
                style={styles.dialogInput}
                mode="outlined"
              />
              <TextInput
                label="Server URL"
                value={editingServer?.apiUrl || ""}
                onChangeText={(text) =>
                  setEditingServer((prev) => prev && { ...prev, apiUrl: text })
                }
                style={styles.dialogInput}
                mode="outlined"
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                label="Username"
                value={editingServer?.username || ""}
                onChangeText={(text) =>
                  setEditingServer(
                    (prev) => prev && { ...prev, username: text },
                  )
                }
                style={styles.dialogInput}
                mode="outlined"
                autoCapitalize="none"
              />
              <PasswordInput
                label="Password"
                value={editingServer?.password || ""}
                onChangeText={(text) =>
                  setEditingServer(
                    (prev) => prev && { ...prev, password: text },
                  )
                }
                style={styles.dialogInput}
                mode="outlined"
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveEdit} loading={saving} disabled={saving}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  serverCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  serverContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  serverInfo: {
    flex: 1,
  },
  serverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  serverName: {
    flex: 1,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  serverDetail: {
    opacity: 0.7,
    marginTop: 2,
  },
  serverActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    opacity: 0.7,
  },
  emptySubtext: {
    marginTop: 4,
    opacity: 0.5,
  },
  dialogScrollArea: {
    paddingHorizontal: 24,
  },
  dialogInput: {
    marginBottom: 12,
  },
});
