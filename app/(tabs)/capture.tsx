import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { TextInput, Button, Text, Snackbar, useTheme, Menu, Divider, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { api, Template, TemplatePrompt, TemplatesResponse } from '@/services/api';

const LAST_TEMPLATE_KEY = 'mova_last_template';

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface PromptFieldProps {
  prompt: TemplatePrompt;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

function PromptField({ prompt, value, onChange }: PromptFieldProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const theme = useTheme();

  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      onChange(formatDateForApi(date));
    }
  }, [onChange]);

  if (prompt.type === 'date') {
    const dateValue = typeof value === 'string' ? value : '';
    return (
      <View style={styles.fieldContainer}>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
          icon="calendar"
        >
          {dateValue ? formatDateForDisplay(dateValue) : `Select ${prompt.name}${prompt.required ? ' *' : ''}`}
        </Button>
        {dateValue && (
          <IconButton
            icon="close"
            size={20}
            onPress={() => onChange('')}
            style={styles.clearButton}
          />
        )}
        {showDatePicker && (
          <DateTimePicker
            value={dateValue ? new Date(dateValue + 'T00:00:00') : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}
      </View>
    );
  }

  if (prompt.type === 'tags') {
    const tagsArray = Array.isArray(value) ? value : (typeof value === 'string' && value ? value.split(',').map(t => t.trim()) : []);
    const [inputValue, setInputValue] = useState('');

    const addTag = () => {
      if (inputValue.trim()) {
        const newTags = [...tagsArray, inputValue.trim()];
        onChange(newTags);
        setInputValue('');
      }
    };

    const removeTag = (index: number) => {
      const newTags = tagsArray.filter((_, i) => i !== index);
      onChange(newTags);
    };

    return (
      <View style={styles.fieldContainer}>
        <Text variant="bodySmall" style={styles.fieldLabel}>
          {prompt.name}{prompt.required ? ' *' : ''}
        </Text>
        <View style={styles.tagsContainer}>
          {tagsArray.map((tag, index) => (
            <Chip
              key={`${tag}-${index}`}
              onClose={() => removeTag(index)}
              style={styles.tag}
            >
              {tag}
            </Chip>
          ))}
        </View>
        <View style={styles.tagInputRow}>
          <TextInput
            mode="outlined"
            placeholder="Add tag..."
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={addTag}
            style={styles.tagInput}
            dense
          />
          <IconButton icon="plus" onPress={addTag} />
        </View>
      </View>
    );
  }

  // Default: string type
  const stringValue = typeof value === 'string' ? value : '';
  return (
    <TextInput
      label={`${prompt.name}${prompt.required ? ' *' : ''}`}
      value={stringValue}
      onChangeText={(text) => onChange(text)}
      mode="outlined"
      style={styles.input}
      multiline={prompt.name.toLowerCase() === 'title' || prompt.name.toLowerCase() === 'body'}
      numberOfLines={prompt.name.toLowerCase() === 'body' ? 4 : 2}
    />
  );
}

export default function CaptureScreen() {
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  const loadTemplates = useCallback(async () => {
    if (!apiUrl || !username || !password) return;

    try {
      api.configure(apiUrl, username, password);
      const data = await api.getTemplates();
      setTemplates(data);

      // Load last used template
      const lastTemplate = await AsyncStorage.getItem(LAST_TEMPLATE_KEY);
      const templateKeys = Object.keys(data);

      if (lastTemplate && templateKeys.includes(lastTemplate)) {
        setSelectedTemplateKey(lastTemplate);
      } else if (templateKeys.length > 0) {
        setSelectedTemplateKey(templateKeys[0]);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setMessage({ text: 'Failed to load capture templates', isError: true });
    } finally {
      setLoading(false);
    }
  }, [apiUrl, username, password]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Reset form values when template changes
  useEffect(() => {
    setValues({});
  }, [selectedTemplateKey]);

  const selectedTemplate = selectedTemplateKey && templates ? templates[selectedTemplateKey] : null;

  const handleTemplateSelect = async (key: string) => {
    setSelectedTemplateKey(key);
    setMenuVisible(false);
    await AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
  };

  const handleValueChange = (promptName: string, value: string | string[]) => {
    setValues(prev => ({ ...prev, [promptName]: value }));
  };

  const handleCapture = async () => {
    if (!selectedTemplateKey || !selectedTemplate) return;

    // Validate required fields
    const missingRequired = selectedTemplate.prompts
      .filter(p => p.required)
      .filter(p => {
        const val = values[p.name];
        if (Array.isArray(val)) return val.length === 0;
        return !val || !val.trim();
      })
      .map(p => p.name);

    if (missingRequired.length > 0) {
      setMessage({ text: `Missing required fields: ${missingRequired.join(', ')}`, isError: true });
      return;
    }

    setSubmitting(true);

    try {
      const result = await api.capture(selectedTemplateKey, values);
      if (result.status === 'created') {
        setMessage({ text: 'Captured!', isError: false });
        setValues({});
      } else {
        setMessage({ text: result.message || 'Capture failed', isError: true });
      }
    } catch (err) {
      console.error('Capture failed:', err);
      setMessage({ text: 'Failed to capture', isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View testID="captureLoadingView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!templates || Object.keys(templates).length === 0) {
    return (
      <View testID="captureEmptyView" style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyLarge" style={{ opacity: 0.6 }}>
          No capture templates available
        </Text>
      </View>
    );
  }

  const templateKeys = Object.keys(templates);

  return (
    <View testID="captureScreen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              icon="chevron-down"
              contentStyle={styles.templateButtonContent}
              testID="templateSelector"
            >
              {selectedTemplate?.name || 'Select Template'}
            </Button>
          }
        >
          {templateKeys.map((key) => (
            <Menu.Item
              key={key}
              onPress={() => handleTemplateSelect(key)}
              title={templates[key].name}
              leadingIcon={key === selectedTemplateKey ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      <Divider />

      <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
        {selectedTemplate?.prompts.map((prompt) => (
          <PromptField
            key={prompt.name}
            prompt={prompt}
            value={values[prompt.name] || (prompt.type === 'tags' ? [] : '')}
            onChange={(value) => handleValueChange(prompt.name, value)}
          />
        ))}

        <Button
          testID="captureButton"
          mode="contained"
          onPress={handleCapture}
          loading={submitting}
          disabled={submitting}
          style={styles.captureButton}
          icon="check"
        >
          Capture
        </Button>
      </ScrollView>

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={3000}
        style={message?.isError ? { backgroundColor: theme.colors.error } : undefined}
      >
        {message?.text}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
  },
  templateButtonContent: {
    flexDirection: 'row-reverse',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  dateButton: {
    flex: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    marginRight: 4,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
  },
  captureButton: {
    marginTop: 8,
  },
});
