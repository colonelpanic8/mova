import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Modal,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";

export interface PrioritySelectModalProps {
  visible: boolean;
  /** Priority to preselect when the modal opens ("" for none). */
  initialPriority: string;
  onDismiss: () => void;
  onSave: (priority: string | null) => void;
}

export function PrioritySelectModal({
  visible,
  initialPriority,
  onDismiss,
  onSave,
}: PrioritySelectModalProps) {
  const theme = useTheme();
  const [selectedPriority, setSelectedPriority] = useState(initialPriority);

  // Re-seed the selection each time the modal opens (render-phase adjustment
  // avoids a flash of stale selection).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelectedPriority(initialPriority);
    }
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          Set Priority
        </Text>

        <RadioButton.Group
          onValueChange={setSelectedPriority}
          value={selectedPriority}
        >
          <RadioButton.Item label="None" value="" />
          <RadioButton.Item label="A - Highest" value="A" />
          <RadioButton.Item label="B - High" value="B" />
          <RadioButton.Item label="C - Medium" value="C" />
          <RadioButton.Item label="D - Low" value="D" />
          <RadioButton.Item label="E - Lowest" value="E" />
        </RadioButton.Group>

        <View style={styles.modalButtons}>
          <Button mode="outlined" onPress={onDismiss}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => onSave(selectedPriority || null)}
          >
            Save
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
});
