import { ScreenContainer } from "@/components/ScreenContainer";
import { usePins } from "@/hooks/usePins";
import { getPinPresets, Pin, PinPreset, setPinPresets } from "@/services/pins";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

function formatTime(epochMillis: number): string {
  return new Date(epochMillis).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pinStatus(pin: Pin): string {
  if (pin.escalated) {
    return `Alerting since ${formatTime(pin.escalateAt)}`;
  }
  if (pin.escalateAt > 0) {
    return `Pinned ${formatTime(pin.createdAt)} · alerts ${formatTime(pin.escalateAt)}`;
  }
  return `Pinned ${formatTime(pin.createdAt)}`;
}

function ActivePinCard({
  pin,
  onDone,
  onSnooze,
}: {
  pin: Pin;
  onDone: () => void;
  onSnooze: () => void;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.pinCard} testID={`pin-${pin.id}`}>
      <Card.Content style={styles.pinCardContent}>
        <View style={styles.pinCardText}>
          <Text variant="titleMedium">{pin.title}</Text>
          <Text
            variant="bodySmall"
            style={{
              color: pin.escalated
                ? theme.colors.error
                : theme.colors.onSurfaceVariant,
            }}
          >
            {pinStatus(pin)}
          </Text>
        </View>
        <Button compact onPress={onSnooze}>
          +10m
        </Button>
        <Button compact mode="contained" onPress={onDone}>
          Done
        </Button>
      </Card.Content>
    </Card>
  );
}

function PresetEditor({
  presets,
  onChange,
}: {
  presets: PinPreset[];
  onChange: (presets: PinPreset[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newMinutes, setNewMinutes] = useState("");

  const addPreset = () => {
    const title = newTitle.trim();
    if (!title) return;
    const minutes = parseInt(newMinutes, 10);
    onChange([
      ...presets,
      { title, minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0 },
    ]);
    setNewTitle("");
    setNewMinutes("");
  };

  return (
    <View>
      {presets.map((preset, index) => (
        <View key={`${preset.title}-${index}`} style={styles.presetRow}>
          <Text style={styles.presetRowLabel}>
            {preset.title}
            {preset.minutes > 0 ? ` · ${preset.minutes} min` : ""}
          </Text>
          <IconButton
            icon="delete-outline"
            size={18}
            accessibilityLabel={`Delete preset ${preset.title}`}
            onPress={() => onChange(presets.filter((_, i) => i !== index))}
          />
        </View>
      ))}
      <View style={styles.presetAddRow}>
        <TextInput
          mode="outlined"
          dense
          style={styles.presetTitleInput}
          placeholder="New preset"
          value={newTitle}
          onChangeText={setNewTitle}
          testID="presetTitleInput"
        />
        <TextInput
          mode="outlined"
          dense
          style={styles.minutesInput}
          placeholder="min"
          keyboardType="number-pad"
          value={newMinutes}
          onChangeText={setNewMinutes}
          testID="presetMinutesInput"
        />
        <IconButton
          icon="plus"
          accessibilityLabel="Add preset"
          onPress={addPreset}
        />
      </View>
    </View>
  );
}

export default function PinsScreen() {
  const theme = useTheme();
  const { available, pins, arm, complete, snooze } = usePins();
  const [presets, setPresets] = useState<PinPreset[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [editingPresets, setEditingPresets] = useState(false);

  useEffect(() => {
    getPinPresets().then(setPresets);
  }, []);

  const updatePresets = useCallback((next: PinPreset[]) => {
    setPresets(next);
    setPinPresets(next);
  }, []);

  const armCustom = async () => {
    const title = customTitle.trim();
    if (!title) return;
    const minutes = parseInt(customMinutes, 10);
    await arm(title, Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
    setCustomTitle("");
    setCustomMinutes("");
  };

  if (!available) {
    return (
      <ScreenContainer testID="pinsScreen">
        <View style={styles.unavailable}>
          <Text variant="bodyMedium">
            Pins are only available in the Android app.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="pinsScreen">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="titleMedium">Pin a reminder</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Holds a persistent notification until you mark it done.
        </Text>

        <View style={styles.chipRow}>
          {presets.map((preset, index) => (
            <Chip
              key={`${preset.title}-${index}`}
              icon="pin"
              style={styles.chip}
              testID={`presetChip-${index}`}
              onPress={() => arm(preset.title, preset.minutes)}
            >
              {preset.title}
              {preset.minutes > 0 ? ` · ${preset.minutes}m` : ""}
            </Chip>
          ))}
        </View>

        <View style={styles.customRow}>
          <TextInput
            mode="outlined"
            dense
            style={styles.customTitleInput}
            placeholder="Something else…"
            value={customTitle}
            onChangeText={setCustomTitle}
            onSubmitEditing={armCustom}
            testID="customPinInput"
          />
          <TextInput
            mode="outlined"
            dense
            style={styles.minutesInput}
            placeholder="min"
            keyboardType="number-pad"
            value={customMinutes}
            onChangeText={setCustomMinutes}
            testID="customPinMinutes"
          />
          <Button
            mode="contained"
            compact
            onPress={armCustom}
            disabled={!customTitle.trim()}
            testID="customPinArm"
          >
            Pin
          </Button>
        </View>

        <View style={styles.activeHeader}>
          <Text variant="titleMedium">Active</Text>
        </View>
        {pins.length === 0 ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Nothing pinned.
          </Text>
        ) : (
          pins.map((pin) => (
            <ActivePinCard
              key={pin.id}
              pin={pin}
              onDone={() => complete(pin.id)}
              onSnooze={() => snooze(pin.id, 10)}
            />
          ))
        )}

        <Button
          style={styles.editPresetsButton}
          compact
          onPress={() => setEditingPresets((editing) => !editing)}
          testID="togglePresetEditor"
        >
          {editingPresets ? "Done editing presets" : "Edit presets"}
        </Button>
        {editingPresets && (
          <PresetEditor presets={presets} onChange={updatePresets} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 8,
  },
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    marginBottom: 4,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customTitleInput: {
    flex: 1,
  },
  minutesInput: {
    width: 64,
  },
  activeHeader: {
    marginTop: 16,
  },
  pinCard: {
    marginTop: 8,
  },
  pinCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pinCardText: {
    flex: 1,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  presetRowLabel: {
    flex: 1,
  },
  presetAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  presetTitleInput: {
    flex: 1,
  },
  editPresetsButton: {
    marginTop: 16,
    alignSelf: "flex-start",
  },
});
