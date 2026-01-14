import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Snackbar, useTheme } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

export default function CaptureScreen() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const { apiUrl, username, password } = useAuth();
  const theme = useTheme();

  async function handleCreate() {
    if (!title.trim()) {
      setMessage({ text: 'Please enter a title', isError: true });
      return;
    }

    if (!apiUrl || !username || !password) {
      setMessage({ text: 'Not connected to server', isError: true });
      return;
    }

    setLoading(true);

    try {
      api.configure(apiUrl, username, password);
      await api.createTodo(title.trim());
      setMessage({ text: 'Todo created!', isError: false });
      setTitle('');
    } catch (err) {
      setMessage({ text: 'Failed to create todo', isError: true });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      testID="captureScreen"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Quick Capture
        </Text>

        <TextInput
          testID="captureInput"
          label="What needs to be done?"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
          multiline
          numberOfLines={3}
        />

        <Button
          testID="captureButton"
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          style={styles.button}
          icon="plus"
        >
          Create Todo
        </Button>
      </View>

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={3000}
        style={message?.isError ? { backgroundColor: theme.colors.error } : undefined}
      >
        {message?.text}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
