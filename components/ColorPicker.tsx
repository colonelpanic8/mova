/**
 * Color Picker Modal Component
 *
 * Allows selecting colors from:
 * - Theme colors (adapt to light/dark mode)
 * - Preset color palette (16 Material Design colors)
 * - Custom hex input
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Portal, Modal, Button, TextInput, useTheme } from 'react-native-paper';
import {
  PRESET_COLORS,
  THEME_COLOR_OPTIONS,
  ColorValue,
  isThemeReference,
  isValidHexColor,
} from '@/types/colors';

interface ColorPickerProps {
  visible: boolean;
  currentColor: ColorValue;
  onSelect: (color: ColorValue) => void;
  onDismiss: () => void;
  title: string;
  showThemeOptions?: boolean;
}

export function ColorPicker({
  visible,
  currentColor,
  onSelect,
  onDismiss,
  title,
  showThemeOptions = true,
}: ColorPickerProps) {
  const theme = useTheme();
  const [customColor, setCustomColor] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customColorError, setCustomColorError] = useState('');

  const handleCustomColorChange = (text: string) => {
    // Auto-add # if not present
    let formatted = text;
    if (text.length > 0 && !text.startsWith('#')) {
      formatted = '#' + text;
    }
    setCustomColor(formatted.toUpperCase());
    setCustomColorError('');
  };

  const handleCustomColorSubmit = () => {
    if (isValidHexColor(customColor)) {
      onSelect(customColor);
      setCustomColor('');
      setShowCustomInput(false);
      setCustomColorError('');
    } else {
      setCustomColorError('Invalid hex color (e.g., #FF5722)');
    }
  };

  const handleSelectColor = (color: ColorValue) => {
    onSelect(color);
    onDismiss();
  };

  const resolveDisplayColor = (colorValue: ColorValue): string => {
    if (isThemeReference(colorValue)) {
      const key = colorValue.replace('theme:', '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (theme.colors as any)[key] || colorValue;
    }
    return colorValue;
  };

  const isSelected = (color: ColorValue): boolean => {
    return currentColor === color;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text variant="titleLarge" style={styles.title}>
            {title}
          </Text>

          {showThemeOptions && (
            <>
              <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                Theme Colors (adapt to light/dark mode)
              </Text>
              <View style={styles.colorGrid}>
                {THEME_COLOR_OPTIONS.map(({ key, label, themeKey }) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.themeColorOption,
                      { backgroundColor: theme.colors[themeKey] },
                      isSelected(key) && [styles.selectedColor, { borderColor: theme.colors.primary }],
                    ]}
                    onPress={() => handleSelectColor(key)}
                  >
                    <Text style={styles.themeColorLabel}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            Preset Colors
          </Text>
          <View style={styles.presetGrid}>
            {PRESET_COLORS.map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  isSelected(color) && [styles.selectedColor, { borderColor: theme.colors.primary }],
                ]}
                onPress={() => handleSelectColor(color)}
              />
            ))}
          </View>

          <Text variant="labelMedium" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            Custom Color
          </Text>
          {showCustomInput ? (
            <View style={styles.customInputContainer}>
              <TextInput
                mode="outlined"
                label="Hex Color"
                placeholder="#FF5722"
                value={customColor}
                onChangeText={handleCustomColorChange}
                style={styles.input}
                maxLength={7}
                autoCapitalize="characters"
                error={!!customColorError}
              />
              {customColorError ? (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{customColorError}</Text>
              ) : null}
              {isValidHexColor(customColor) && (
                <View style={styles.previewRow}>
                  <Text style={{ color: theme.colors.onSurface }}>Preview: </Text>
                  <View style={[styles.previewSwatch, { backgroundColor: customColor }]} />
                </View>
              )}
              <View style={styles.customButtonRow}>
                <Button mode="outlined" onPress={() => setShowCustomInput(false)} style={styles.customButton}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={handleCustomColorSubmit} style={styles.customButton}>
                  Apply
                </Button>
              </View>
            </View>
          ) : (
            <Button mode="outlined" onPress={() => setShowCustomInput(true)} icon="palette">
              Enter Custom Hex Color
            </Button>
          )}

          <View style={styles.currentColorRow}>
            <Text style={{ color: theme.colors.onSurface }}>Current: </Text>
            <View style={[styles.currentSwatch, { backgroundColor: resolveDisplayColor(currentColor) }]} />
            <Text style={[styles.currentColorText, { color: theme.colors.onSurfaceVariant }]}>
              {currentColor}
            </Text>
          </View>

          <Button mode="text" onPress={onDismiss} style={styles.cancelButton}>
            Close
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeColorOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  themeColorLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  selectedColor: {
    borderWidth: 3,
  },
  customInputContainer: {
    gap: 8,
  },
  input: {
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginLeft: 8,
  },
  customButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customButton: {
    flex: 1,
  },
  currentColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  currentSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  currentColorText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  cancelButton: {
    marginTop: 16,
  },
});
