import { PlatformDatePicker } from "@/components/PlatformDatePicker";
import { StatePill } from "@/components/StatePill";
import { Todo } from "@/services/api";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  List,
  Modal,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";

export interface StateChangeModalProps {
  visible: boolean;
  todo: Todo | null;
  /** All selectable states (active + done). */
  states: string[];
  onDismiss: () => void;
  onConfirm: (state: string, overrideDate: Date | null) => void;
}

export function StateChangeModal({
  visible,
  todo,
  states,
  onDismiss,
  onConfirm,
}: StateChangeModalProps) {
  const theme = useTheme();
  const [selectedState, setSelectedState] = useState(todo?.todo || "");
  const [overrideDate, setOverrideDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Re-seed local state each time the modal opens (render-phase adjustment
  // avoids a flash of stale selection).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelectedState(todo?.todo || "");
      setOverrideDate(null);
      setShowDatePicker(false);
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
          Change State
        </Text>
        <Text
          variant="bodyMedium"
          style={styles.modalSubtitle}
          numberOfLines={1}
        >
          {todo?.title}
        </Text>

        <RadioButton.Group
          onValueChange={setSelectedState}
          value={selectedState}
        >
          {states.map((state) => (
            <Pressable
              key={state}
              onPress={() => setSelectedState(state)}
              style={styles.stateRow}
            >
              <RadioButton value={state} />
              <StatePill
                state={state}
                selected={state === selectedState}
                dimWhenUnselected={false}
              />
            </Pressable>
          ))}
        </RadioButton.Group>

        {/* Override date option */}
        <List.Item
          title="Effective Date"
          description={
            overrideDate ? overrideDate.toLocaleDateString() : "Today (default)"
          }
          left={(props) => <List.Icon {...props} icon="calendar" />}
          onPress={() => {
            if (Platform.OS === "web") {
              // Web: toggle picker visibility
              setShowDatePicker((prev) => !prev);
            } else {
              // Native: show native picker
              setShowDatePicker(true);
            }
          }}
          right={(props) =>
            overrideDate ? (
              <Pressable
                onPress={() => setOverrideDate(null)}
                style={{ justifyContent: "center" }}
              >
                <List.Icon {...props} icon="close" />
              </Pressable>
            ) : null
          }
          style={styles.overrideDateItem}
        />
        <PlatformDatePicker
          mode="date"
          webInline
          visible={showDatePicker}
          value={overrideDate ?? new Date()}
          onChange={(date) => {
            setOverrideDate(date);
            setShowDatePicker(false);
          }}
          onDismiss={() => setShowDatePicker(false)}
        />

        <View style={styles.modalButtons}>
          <Button mode="outlined" onPress={onDismiss}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => onConfirm(selectedState, overrideDate)}
            disabled={selectedState === todo?.todo}
          >
            Change
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
  modalSubtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  overrideDateItem: {
    marginTop: 8,
    marginBottom: 0,
    paddingVertical: 0,
  },
});
