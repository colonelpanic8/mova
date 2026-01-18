import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

const DEFAULT_URLS = ["https://colonelpanic-org-agenda.fly.dev"];

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
  const { login } = useAuth();
  const theme = useTheme();

  // On web, auto-detect origin and lock the server field
  useEffect(() => {
    const origin = getWebOrigin();
    if (origin) {
      setApiUrl(origin);
      setServerLocked(true);
    }
  }, []);

  const filteredUrls = DEFAULT_URLS.filter((url) =>
    url.toLowerCase().includes(apiUrl.toLowerCase()),
  );

  const handleUrlSelect = (url: string) => {
    setApiUrl(url);
    setShowUrlSuggestions(false);
  };

  const handleUnlockServer = () => {
    setServerLocked(false);
  };

  const handleLockServer = () => {
    if (apiUrl) {
      setServerLocked(true);
      setShowUrlSuggestions(false);
    }
  };

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

    // Unlocked state - show editable text input with suggestions
    return (
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
              onBlur={() => {
                // Delay to allow menu item click to register
                setTimeout(() => setShowUrlSuggestions(false), 150);
              }}
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
          }
          anchorPosition="bottom"
          style={styles.menu}
        >
          {filteredUrls.map((url, index) => (
            <Menu.Item
              key={url}
              onPress={() => {
                handleUrlSelect(url);
                setServerLocked(true);
              }}
              title={url}
              testID={`urlSuggestion-${index}`}
            />
          ))}
        </Menu>
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
          Mova v{Constants.expoConfig?.version}
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
    zIndex: 1,
  },
  input: {
    marginBottom: 0,
  },
  otherInput: {
    marginBottom: 16,
  },
  menu: {
    width: "100%",
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
