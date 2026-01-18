import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { normalizeUrl } from "@/utils/url";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const DEFAULT_URLS = ["https://colonelpanic-org-agenda.fly.dev"];
const URL_HISTORY_KEY = "mova_url_history";
const MAX_URL_HISTORY = 5;

// Detect the current origin on web platform
function getWebOrigin(): string | null {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return null;
}

export default function LoginScreen() {
  const [apiUrl, setApiUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false);
  const [serverLocked, setServerLocked] = useState(false);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const justSelectedRef = useRef(false);
  const { login } = useAuth();
  const theme = useTheme();

  // Load URL history from storage
  useEffect(() => {
    async function loadUrlHistory() {
      try {
        const stored = await AsyncStorage.getItem(URL_HISTORY_KEY);
        if (stored) {
          setUrlHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("Failed to load URL history:", e);
      }
    }
    loadUrlHistory();
  }, []);

  // On web, auto-detect origin and lock the server field
  useEffect(() => {
    const origin = getWebOrigin();
    if (origin) {
      setApiUrl(origin);
      setServerLocked(true);
    }
  }, []);

  // Save URL to history after successful login
  const saveUrlToHistory = useCallback(async (url: string) => {
    try {
      const normalized = normalizeUrl(url);
      const newHistory = [
        normalized,
        ...urlHistory.filter((u) => u !== normalized),
      ].slice(0, MAX_URL_HISTORY);
      setUrlHistory(newHistory);
      await AsyncStorage.setItem(URL_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.warn("Failed to save URL history:", e);
    }
  }, [urlHistory]);

  // Combine defaults and history, filter by current input
  const allUrls = [...new Set([...urlHistory, ...DEFAULT_URLS])];
  const filteredUrls = allUrls.filter(
    (url) =>
      url.toLowerCase().includes(apiUrl.toLowerCase()) &&
      url.toLowerCase() !== apiUrl.toLowerCase(),
  );

  // Show suggestions when focused, has matches, and didn't just select
  const shouldShowSuggestions =
    isFocused && filteredUrls.length > 0 && !justSelectedRef.current;

  const handleUrlSelect = useCallback((url: string) => {
    justSelectedRef.current = true;
    setApiUrl(url);
    setShowUrlSuggestions(false);
    setServerLocked(true);
    // Reset the flag after a short delay
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 100);
  }, []);

  const handleUnlockServer = useCallback(() => {
    setServerLocked(false);
  }, []);

  const handleLockServer = useCallback(() => {
    if (apiUrl) {
      setServerLocked(true);
      setShowUrlSuggestions(false);
    }
  }, [apiUrl]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (!justSelectedRef.current) {
      setShowUrlSuggestions(true);
    }
  }, []);

  const handleBlur = useCallback(() => {
    // Delay both state changes to allow tap on suggestion to register
    setTimeout(() => {
      setIsFocused(false);
      setShowUrlSuggestions(false);
    }, 200);
  }, []);

  async function handleLogin() {
    if (!apiUrl || !username || !password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[LoginScreen] Calling login()...");
      const success = await login(apiUrl, username, password);
      console.log("[LoginScreen] login() returned:", success);
      if (success) {
        // Configure the API service
        console.log("[LoginScreen] Configuring API service...");
        api.configure(apiUrl, username, password);
        // Save URL to history on successful login
        await saveUrlToHistory(apiUrl);
        console.log(
          "[LoginScreen] API configured, navigation should happen via context update",
        );
      } else {
        setError("Invalid credentials or server URL");
      }
    } catch {
      setError("Connection failed. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  const renderServerField = () => {
    if (serverLocked) {
      // Locked state - show as a chip/badge with edit button
      return (
        <View style={styles.lockedServerContainer}>
          <View style={styles.lockedServerContent}>
            <Text variant="labelMedium" style={styles.lockedServerLabel}>
              Server
            </Text>
            <Chip
              icon="server"
              mode="outlined"
              style={styles.serverChip}
              textStyle={styles.serverChipText}
            >
              {apiUrl}
            </Chip>
          </View>
          <Button
            mode="text"
            compact
            onPress={handleUnlockServer}
            style={styles.editButton}
          >
            Edit
          </Button>
        </View>
      );
    }

    // Unlocked state - show editable text input with inline suggestions
    return (
      <View style={styles.urlInputContainer}>
        <TextInput
          testID="serverUrlInput"
          label="Server URL"
          value={apiUrl}
          onChangeText={(text) => {
            setApiUrl(text);
            if (!justSelectedRef.current) {
              setShowUrlSuggestions(true);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleLockServer}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://your-server.fly.dev"
          style={styles.input}
          mode="outlined"
          right={
            apiUrl ? (
              <TextInput.Icon icon="check" onPress={handleLockServer} />
            ) : undefined
          }
        />
        {showUrlSuggestions && shouldShowSuggestions && (
          <Surface style={styles.suggestionsContainer} elevation={2}>
            <ScrollView
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {filteredUrls.map((url, index) => (
                <Pressable
                  key={url}
                  testID={`urlSuggestion-${index}`}
                  onPressIn={() => handleUrlSelect(url)}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    pressed && { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {url}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Surface>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Image
          source={require("@/assets/images/mova.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text variant="bodyMedium" style={styles.subtitle}>
          Connect to your org-agenda-api server
        </Text>

        {renderServerField()}

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

        <Text variant="bodySmall" style={styles.versionText}>
          Mova v{Constants.expoConfig?.version} (
          {Constants.expoConfig?.extra?.gitCommit})
        </Text>
      </View>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError("")}
        duration={3000}
        action={{
          label: "Dismiss",
          onPress: () => setError(""),
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
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 150,
    alignSelf: "center",
    marginBottom: 16,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 32,
    opacity: 0.7,
  },
  urlInputContainer: {
    marginBottom: 16,
    zIndex: 10,
  },
  input: {
    marginBottom: 0,
  },
  otherInput: {
    marginBottom: 16,
  },
  suggestionsContainer: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    borderRadius: 4,
    maxHeight: 200,
    zIndex: 100,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  button: {
    marginTop: 8,
  },
  lockedServerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  lockedServerContent: {
    flex: 1,
  },
  lockedServerLabel: {
    marginBottom: 4,
    opacity: 0.7,
  },
  serverChip: {
    alignSelf: "flex-start",
  },
  serverChipText: {
    fontSize: 14,
  },
  editButton: {
    marginLeft: 8,
  },
  versionText: {
    textAlign: "center",
    marginTop: 24,
    opacity: 0.5,
  },
});
