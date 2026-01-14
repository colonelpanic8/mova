import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Snackbar, useTheme, Menu } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

const DEFAULT_URLS = [
  'https://colonelpanic-org-agenda.fly.dev',
];

export default function LoginScreen() {
  const [apiUrl, setApiUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false);
  const { login } = useAuth();
  const theme = useTheme();

  const filteredUrls = DEFAULT_URLS.filter(url =>
    url.toLowerCase().includes(apiUrl.toLowerCase())
  );

  const handleUrlSelect = (url: string) => {
    setApiUrl(url);
    setShowUrlSuggestions(false);
  };

  async function handleLogin() {
    if (!apiUrl || !username || !password) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await login(apiUrl, username, password);
      if (success) {
        // Configure the API service
        api.configure(apiUrl, username, password);
      } else {
        setError('Invalid credentials or server URL');
      }
    } catch (err) {
      setError('Connection failed. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Mova
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Connect to your org-agenda-api server
        </Text>

        <View style={styles.urlInputContainer}>
          <Menu
            visible={showUrlSuggestions && filteredUrls.length > 0}
            onDismiss={() => setShowUrlSuggestions(false)}
            anchor={
              <TextInput
                testID="serverUrlInput"
                label="Server URL"
                value={apiUrl}
                onChangeText={(text) => {
                  setApiUrl(text);
                  setShowUrlSuggestions(true);
                }}
                onFocus={() => setShowUrlSuggestions(true)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://your-server.fly.dev"
                style={styles.input}
                mode="outlined"
              />
            }
            anchorPosition="bottom"
            style={styles.menu}
          >
            {filteredUrls.map((url, index) => (
              <Menu.Item
                key={url}
                onPress={() => handleUrlSelect(url)}
                title={url}
                testID={`urlSuggestion-${index}`}
              />
            ))}
          </Menu>
        </View>

        <TextInput
          testID="usernameInput"
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.otherInput}
          mode="outlined"
        />

        <TextInput
          testID="passwordInput"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.otherInput}
          mode="outlined"
        />

        <Button
          testID="connectButton"
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Connect
        </Button>
      </View>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError('')}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: () => setError(''),
        }}
      >
        {error}
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
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  urlInputContainer: {
    marginBottom: 16,
    zIndex: 1,
  },
  input: {
    marginBottom: 0,
  },
  otherInput: {
    marginBottom: 16,
  },
  menu: {
    width: '100%',
  },
  button: {
    marginTop: 8,
  },
});
