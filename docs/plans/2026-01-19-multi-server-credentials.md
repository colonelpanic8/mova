# Multi-Server Credentials Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to save multiple server credentials and switch between them instantly.

**Architecture:** Add SavedServer storage alongside existing single-credential storage. AuthContext gains multi-server methods while maintaining backward compatibility. Login screen shows server picker, settings screen adds password visibility and server management.

**Tech Stack:** React Native, AsyncStorage, react-native-paper, expo-router, TypeScript

---

## Task 1: Create SavedServer Types and Storage Utilities

**Files:**
- Create: `types/server.ts`
- Create: `utils/serverStorage.ts`
- Create: `tests/unit/serverStorage.test.ts`

**Step 1: Write the failing test for server storage**

```typescript
// tests/unit/serverStorage.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSavedServers,
  saveServer,
  updateServer,
  deleteServer,
  getActiveServerId,
  setActiveServerId,
} from "../../utils/serverStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("serverStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSavedServers", () => {
    it("should return empty array when no servers saved", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const servers = await getSavedServers();
      expect(servers).toEqual([]);
    });

    it("should return parsed servers from storage", async () => {
      const mockServers = [
        { id: "1", apiUrl: "https://server1.com", username: "user1", password: "pass1" },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockServers));
      const servers = await getSavedServers();
      expect(servers).toEqual(mockServers);
    });
  });

  describe("saveServer", () => {
    it("should add new server with generated id", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const server = await saveServer({
        apiUrl: "https://new.com",
        username: "user",
        password: "pass",
      });
      expect(server.id).toBeDefined();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("deleteServer", () => {
    it("should remove server by id", async () => {
      const mockServers = [
        { id: "1", apiUrl: "https://server1.com", username: "user1", password: "pass1" },
        { id: "2", apiUrl: "https://server2.com", username: "user2", password: "pass2" },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockServers));
      await deleteServer("1");
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_saved_servers",
        JSON.stringify([mockServers[1]])
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="serverStorage" --watch=false`
Expected: FAIL with "Cannot find module '../../utils/serverStorage'"

**Step 3: Create the types file**

```typescript
// types/server.ts
export interface SavedServer {
  id: string;
  nickname?: string;
  apiUrl: string;
  username: string;
  password: string;
}

export type SavedServerInput = Omit<SavedServer, "id">;
```

**Step 4: Write minimal implementation**

```typescript
// utils/serverStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SavedServer, SavedServerInput } from "@/types/server";

const STORAGE_KEYS = {
  SAVED_SERVERS: "mova_saved_servers",
  ACTIVE_SERVER_ID: "mova_active_server_id",
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function getSavedServers(): Promise<SavedServer[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SERVERS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveServer(input: SavedServerInput): Promise<SavedServer> {
  const servers = await getSavedServers();
  const newServer: SavedServer = { ...input, id: generateId() };
  servers.push(newServer);
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SERVERS, JSON.stringify(servers));
  return newServer;
}

export async function updateServer(id: string, updates: Partial<SavedServerInput>): Promise<void> {
  const servers = await getSavedServers();
  const index = servers.findIndex((s) => s.id === id);
  if (index !== -1) {
    servers[index] = { ...servers[index], ...updates };
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SERVERS, JSON.stringify(servers));
  }
}

export async function deleteServer(id: string): Promise<void> {
  const servers = await getSavedServers();
  const filtered = servers.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SERVERS, JSON.stringify(filtered));
}

export async function getActiveServerId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SERVER_ID);
}

export async function setActiveServerId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SERVER_ID, id);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVER_ID);
  }
}

export async function findServerById(id: string): Promise<SavedServer | undefined> {
  const servers = await getSavedServers();
  return servers.find((s) => s.id === id);
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --testPathPattern="serverStorage" --watch=false`
Expected: PASS

**Step 6: Commit**

```bash
git add types/server.ts utils/serverStorage.ts tests/unit/serverStorage.test.ts
git commit -m "feat: add SavedServer types and storage utilities"
```

---

## Task 2: Update AuthContext with Multi-Server Methods

**Files:**
- Modify: `context/AuthContext.tsx`
- Create: `tests/unit/AuthContext.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/AuthContext.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
}));

jest.mock("../../services/api", () => ({
  api: {
    configure: jest.fn(),
    setOnUnauthorized: jest.fn(),
  },
}));

jest.mock("../../widgets/storage", () => ({
  saveCredentialsToWidget: jest.fn(),
  clearWidgetCredentials: jest.fn(),
}));

// Test the storage utilities used by AuthContext
import * as serverStorage from "../../utils/serverStorage";

describe("AuthContext multi-server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load saved servers on init", async () => {
    const spy = jest.spyOn(serverStorage, "getSavedServers");
    spy.mockResolvedValue([
      { id: "1", apiUrl: "https://test.com", username: "user", password: "pass" },
    ]);

    const servers = await serverStorage.getSavedServers();
    expect(servers.length).toBe(1);
    spy.mockRestore();
  });
});
```

**Step 2: Run test to verify setup works**

Run: `npm test -- --testPathPattern="AuthContext.test" --watch=false`
Expected: PASS (basic setup test)

**Step 3: Update AuthContext interface and state**

Modify `context/AuthContext.tsx` - add to interface (after line 60):

```typescript
interface AuthContextType extends AuthState {
  login: (
    apiUrl: string,
    username: string,
    password: string,
    save?: boolean,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  getAuthHeader: () => string | null;
  // New multi-server methods
  savedServers: SavedServer[];
  activeServerId: string | null;
  switchServer: (serverId: string) => Promise<boolean>;
  saveCurrentServer: (nickname?: string) => Promise<SavedServer | null>;
  updateServer: (id: string, updates: Partial<SavedServerInput>) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  refreshSavedServers: () => Promise<void>;
}
```

**Step 4: Add imports and state to AuthProvider**

Add imports at top of file:

```typescript
import { SavedServer, SavedServerInput } from "@/types/server";
import {
  getSavedServers,
  saveServer as saveServerToStorage,
  updateServer as updateServerInStorage,
  deleteServer as deleteServerFromStorage,
  getActiveServerId,
  setActiveServerId,
  findServerById,
} from "@/utils/serverStorage";
```

Add state in AuthProvider (after line 78):

```typescript
const [savedServers, setSavedServers] = useState<SavedServer[]>([]);
const [activeServerId, setActiveServerIdState] = useState<string | null>(null);
```

**Step 5: Add multi-server methods to AuthProvider**

Add these functions inside AuthProvider (after loadStoredCredentials):

```typescript
async function refreshSavedServers() {
  const servers = await getSavedServers();
  setSavedServers(servers);
}

async function switchServer(serverId: string): Promise<boolean> {
  const server = await findServerById(serverId);
  if (!server) return false;

  const success = await login(server.apiUrl, server.username, server.password, false);
  if (success) {
    await setActiveServerId(serverId);
    setActiveServerIdState(serverId);
  }
  return success;
}

async function saveCurrentServer(nickname?: string): Promise<SavedServer | null> {
  if (!state.apiUrl || !state.username || !state.password) return null;

  const newServer = await saveServerToStorage({
    nickname,
    apiUrl: state.apiUrl,
    username: state.username,
    password: state.password,
  });

  await setActiveServerId(newServer.id);
  setActiveServerIdState(newServer.id);
  await refreshSavedServers();
  return newServer;
}

async function handleUpdateServer(id: string, updates: Partial<SavedServerInput>): Promise<void> {
  await updateServerInStorage(id, updates);
  await refreshSavedServers();

  // If updating the active server, update current credentials too
  if (id === activeServerId && state.isAuthenticated) {
    const updated = await findServerById(id);
    if (updated) {
      setState((prev) => ({
        ...prev,
        apiUrl: updated.apiUrl,
        username: updated.username,
        password: updated.password,
      }));
    }
  }
}

async function handleDeleteServer(id: string): Promise<void> {
  await deleteServerFromStorage(id);
  await refreshSavedServers();

  // If deleting the active server, clear active server id
  if (id === activeServerId) {
    await setActiveServerId(null);
    setActiveServerIdState(null);
  }
}
```

**Step 6: Update loadStoredCredentials to also load saved servers**

Modify loadStoredCredentials to also load savedServers and activeServerId:

```typescript
async function loadStoredCredentials() {
  try {
    // Load saved servers
    const servers = await getSavedServers();
    setSavedServers(servers);

    const storedActiveId = await getActiveServerId();
    setActiveServerIdState(storedActiveId);

    // Check for test launch args first (for Detox auto-login)
    const testArgs = await getTestLaunchArgs();
    if (testArgs?.apiUrl && testArgs?.username && testArgs?.password) {
      console.log("Auto-login with test launch args");
      setState({
        apiUrl: testArgs.apiUrl,
        username: testArgs.username,
        password: testArgs.password,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    const [apiUrl, username, password] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.API_URL),
      AsyncStorage.getItem(STORAGE_KEYS.USERNAME),
      AsyncStorage.getItem(STORAGE_KEYS.PASSWORD),
    ]);

    if (apiUrl && username && password) {
      setState({
        apiUrl,
        username,
        password,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  } catch (error) {
    console.error("Failed to load credentials:", error);
    setState((prev) => ({ ...prev, isLoading: false }));
  }
}
```

**Step 7: Update login function to optionally save**

Modify login function signature and add save logic:

```typescript
async function login(
  apiUrl: string,
  username: string,
  password: string,
  save: boolean = true,
): Promise<boolean> {
  try {
    const normalizedUrl = normalizeUrl(apiUrl);
    const response = await fetch(`${normalizedUrl}/templates`, {
      headers: {
        Authorization: `Basic ${base64Encode(`${username}:${password}`)}`,
      },
    });

    if (response.ok) {
      console.log("[AuthContext] Login successful, saving credentials...");
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.API_URL, normalizedUrl),
        AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username),
        AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password),
      ]);

      await saveCredentialsToWidget(normalizedUrl, username, password);

      // Save to server list if requested
      if (save) {
        // Check if server already exists
        const existing = savedServers.find(
          (s) => s.apiUrl === normalizedUrl && s.username === username
        );
        if (!existing) {
          const newServer = await saveServerToStorage({
            apiUrl: normalizedUrl,
            username,
            password,
          });
          await setActiveServerId(newServer.id);
          setActiveServerIdState(newServer.id);
          await refreshSavedServers();
        } else {
          // Update password if changed
          if (existing.password !== password) {
            await updateServerInStorage(existing.id, { password });
            await refreshSavedServers();
          }
          await setActiveServerId(existing.id);
          setActiveServerIdState(existing.id);
        }
      }

      console.log("[AuthContext] Credentials saved, updating state...");
      setState({
        apiUrl: normalizedUrl,
        username,
        password,
        isAuthenticated: true,
        isLoading: false,
      });
      console.log("[AuthContext] State updated, isAuthenticated=true");

      return true;
    }

    return false;
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  }
}
```

**Step 8: Update logout to clear active server id**

Modify logout function:

```typescript
async function logout() {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.API_URL),
    AsyncStorage.removeItem(STORAGE_KEYS.USERNAME),
    AsyncStorage.removeItem(STORAGE_KEYS.PASSWORD),
  ]);

  await clearWidgetCredentials();
  await setActiveServerId(null);
  setActiveServerIdState(null);

  setState({
    apiUrl: null,
    username: null,
    password: null,
    isAuthenticated: false,
    isLoading: false,
  });
}
```

**Step 9: Update provider value**

Update the return statement:

```typescript
return (
  <AuthContext.Provider
    value={{
      ...state,
      login,
      logout,
      getAuthHeader,
      savedServers,
      activeServerId,
      switchServer,
      saveCurrentServer,
      updateServer: handleUpdateServer,
      deleteServer: handleDeleteServer,
      refreshSavedServers,
    }}
  >
    {children}
  </AuthContext.Provider>
);
```

**Step 10: Run tests to verify nothing broke**

Run: `npm test -- --watch=false`
Expected: All tests PASS

**Step 11: Commit**

```bash
git add context/AuthContext.tsx tests/unit/AuthContext.test.ts
git commit -m "feat: add multi-server methods to AuthContext"
```

---

## Task 3: Create PasswordInput Component with Show/Hide Toggle

**Files:**
- Create: `components/PasswordInput.tsx`

**Step 1: Create the reusable component**

```typescript
// components/PasswordInput.tsx
import React, { useState } from "react";
import { TextInput, TextInputProps } from "react-native-paper";

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry" | "right"> {
  testID?: string;
}

export function PasswordInput({ testID, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextInput
      testID={testID}
      secureTextEntry={!showPassword}
      right={
        <TextInput.Icon
          testID={testID ? `${testID}-toggle` : "password-toggle"}
          icon={showPassword ? "eye-off" : "eye"}
          onPress={() => setShowPassword(!showPassword)}
        />
      }
      {...props}
    />
  );
}
```

**Step 2: Commit**

```bash
git add components/PasswordInput.tsx
git commit -m "feat: add PasswordInput component with show/hide toggle"
```

---

## Task 4: Update Login Screen with Saved Servers List

**Files:**
- Modify: `app/login.tsx`

**Step 1: Add imports**

Add at top of login.tsx:

```typescript
import { PasswordInput } from "@/components/PasswordInput";
import { SavedServer } from "@/types/server";
```

**Step 2: Update useAuth destructure**

Change line 49:

```typescript
const { login, savedServers, switchServer, activeServerId } = useAuth();
```

**Step 3: Add switching state**

Add after existing useState declarations (around line 48):

```typescript
const [switchingServerId, setSwitchingServerId] = useState<string | null>(null);
```

**Step 4: Add server switch handler**

Add after handleLogin function:

```typescript
async function handleServerSelect(server: SavedServer) {
  setSwitchingServerId(server.id);
  setError("");

  try {
    const success = await switchServer(server.id);
    if (success) {
      api.configure(server.apiUrl, server.username, server.password);
    } else {
      setError("Failed to connect to saved server");
    }
  } catch {
    setError("Connection failed");
  } finally {
    setSwitchingServerId(null);
  }
}
```

**Step 5: Add saved servers list component**

Add this function before the return statement:

```typescript
const renderSavedServers = () => {
  if (savedServers.length === 0) return null;

  return (
    <>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Saved Servers
      </Text>
      <Surface style={styles.serverList} elevation={1}>
        {savedServers.map((server) => (
          <Pressable
            key={server.id}
            testID={`savedServer-${server.id}`}
            onPress={() => handleServerSelect(server)}
            disabled={switchingServerId !== null}
            style={({ pressed }) => [
              styles.serverItem,
              pressed && { backgroundColor: theme.colors.surfaceVariant },
              server.id === activeServerId && styles.activeServer,
            ]}
          >
            <View style={styles.serverItemContent}>
              <Text variant="titleSmall" numberOfLines={1}>
                {server.nickname || server.apiUrl}
              </Text>
              <Text variant="bodySmall" style={styles.serverUsername}>
                {server.username}
                {server.nickname && ` - ${server.apiUrl}`}
              </Text>
            </View>
            {switchingServerId === server.id ? (
              <ActivityIndicator size="small" />
            ) : server.id === activeServerId ? (
              <List.Icon icon="check" color={theme.colors.primary} />
            ) : null}
          </Pressable>
        ))}
      </Surface>

      <View style={styles.dividerContainer}>
        <Divider style={styles.divider} />
        <Text variant="bodySmall" style={styles.dividerText}>
          or connect to a new server
        </Text>
        <Divider style={styles.divider} />
      </View>
    </>
  );
};
```

**Step 6: Add required imports for new components**

Update imports from react-native-paper:

```typescript
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  List,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
```

**Step 7: Update return to include saved servers**

In the return statement, add renderSavedServers() before renderServerField():

```typescript
return (
  <KeyboardAvoidingView
    style={[styles.container, { backgroundColor: theme.colors.background }]}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
  >
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <Image
          source={require("@/assets/images/mova.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text variant="bodyMedium" style={styles.subtitle}>
          Connect to your org-agenda-api server
        </Text>

        {renderSavedServers()}

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

        <PasswordInput
          testID="passwordInput"
          label="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.otherInput}
          mode="outlined"
        />

        <Button
          testID="connectButton"
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading || switchingServerId !== null}
          style={styles.button}
        >
          Connect
        </Button>

        <Text variant="bodySmall" style={styles.versionText}>
          Mova v{Constants.expoConfig?.version} (
          {Constants.expoConfig?.extra?.gitCommit})
        </Text>
      </View>
    </ScrollView>

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
```

**Step 8: Update styles**

Add new styles:

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 24,
    opacity: 0.7,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  serverList: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
  },
  serverItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  activeServer: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  serverItemContent: {
    flex: 1,
  },
  serverUsername: {
    opacity: 0.7,
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    opacity: 0.5,
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
```

**Step 9: Run app to verify visually**

Run: `npm run ios` or `npm run android`
Expected: Login screen shows saved servers list (empty initially), password field has eye icon

**Step 10: Run tests**

Run: `npm test -- --watch=false`
Expected: All tests PASS

**Step 11: Commit**

```bash
git add app/login.tsx components/PasswordInput.tsx
git commit -m "feat: add saved servers list and password toggle to login screen"
```

---

## Task 5: Update Settings Screen with Password Display and Manage Servers Link

**Files:**
- Modify: `app/(tabs)/settings/index.tsx`

**Step 1: Add state for password visibility**

Add after existing useState declarations:

```typescript
const [showPassword, setShowPassword] = useState(false);
```

**Step 2: Update useAuth destructure**

Change line 29:

```typescript
const { apiUrl, username, password, logout } = useAuth();
```

**Step 3: Update Connection section**

Replace the existing Connection List.Section with:

```typescript
<List.Section>
  <List.Subheader>Connection</List.Subheader>
  <List.Item
    title="Server URL"
    description={apiUrl || "Not connected"}
    left={(props) => <List.Icon {...props} icon="server" />}
  />
  <List.Item
    title="Username"
    description={username || "Not logged in"}
    left={(props) => <List.Icon {...props} icon="account" />}
  />
  <List.Item
    title="Password"
    description={showPassword ? password : "••••••••"}
    left={(props) => <List.Icon {...props} icon="lock" />}
    right={(props) => (
      <Pressable onPress={() => setShowPassword(!showPassword)}>
        <List.Icon {...props} icon={showPassword ? "eye-off" : "eye"} />
      </Pressable>
    )}
  />
  <List.Item
    title="Manage Servers"
    description="Switch, edit, or delete saved servers"
    left={(props) => <List.Icon {...props} icon="server-network" />}
    onPress={() => router.push("./servers")}
    right={(props) => <List.Icon {...props} icon="chevron-right" />}
  />
</List.Section>
```

**Step 4: Add Pressable import**

Add to imports from react-native:

```typescript
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
```

**Step 5: Run tests**

Run: `npm test -- --watch=false`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add app/(tabs)/settings/index.tsx
git commit -m "feat: add password display and manage servers link to settings"
```

---

## Task 6: Create Manage Servers Screen

**Files:**
- Create: `app/(tabs)/settings/servers.tsx`
- Modify: `app/(tabs)/settings/_layout.tsx`

**Step 1: Create the servers screen**

```typescript
// app/(tabs)/settings/servers.tsx
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/context/AuthContext";
import { SavedServer, SavedServerInput } from "@/types/server";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  FAB,
  List,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

type EditingServer = SavedServer | { id: null } & SavedServerInput;

export default function ServersScreen() {
  const theme = useTheme();
  const {
    savedServers,
    activeServerId,
    switchServer,
    updateServer,
    deleteServer,
    refreshSavedServers,
  } = useAuth();

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<EditingServer | null>(null);
  const [saving, setSaving] = useState(false);

  const handleServerPress = async (server: SavedServer) => {
    if (server.id === activeServerId) return;

    setSwitchingId(server.id);
    try {
      const success = await switchServer(server.id);
      if (!success) {
        Alert.alert("Connection Failed", "Could not connect to the server. Check your credentials.");
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
      ]
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
              <Text variant="titleMedium" numberOfLines={1} style={styles.serverName}>
                {server.nickname || server.apiUrl}
              </Text>
              {isActive && (
                <Text variant="labelSmall" style={[styles.activeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                  Active
                </Text>
              )}
            </View>
            <Text variant="bodySmall" style={styles.serverDetail}>
              {server.username}
            </Text>
            {server.nickname && (
              <Text variant="bodySmall" style={styles.serverDetail} numberOfLines={1}>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Edit Server</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nickname (optional)"
              value={editingServer?.nickname || ""}
              onChangeText={(text) =>
                setEditingServer((prev) => prev && { ...prev, nickname: text || undefined })
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
                setEditingServer((prev) => prev && { ...prev, username: text })
              }
              style={styles.dialogInput}
              mode="outlined"
              autoCapitalize="none"
            />
            <PasswordInput
              label="Password"
              value={editingServer?.password || ""}
              onChangeText={(text) =>
                setEditingServer((prev) => prev && { ...prev, password: text })
              }
              style={styles.dialogInput}
              mode="outlined"
            />
          </Dialog.Content>
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
  dialogInput: {
    marginBottom: 12,
  },
});
```

**Step 2: Register the screen in layout**

Modify `app/(tabs)/settings/_layout.tsx`:

```typescript
import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";

export default function SettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="colors" options={{ title: "Colors" }} />
      <Stack.Screen
        name="notifications"
        options={{ title: "Scheduled Notifications" }}
      />
      <Stack.Screen name="servers" options={{ title: "Manage Servers" }} />
    </Stack>
  );
}
```

**Step 3: Run app to verify**

Run: `npm run ios` or `npm run android`
Expected: Can navigate to Manage Servers from Settings, see list of servers, edit/delete them

**Step 4: Run tests**

Run: `npm test -- --watch=false`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add app/(tabs)/settings/servers.tsx app/(tabs)/settings/_layout.tsx
git commit -m "feat: add Manage Servers screen"
```

---

## Task 7: Final Integration Testing and Cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npm test -- --watch=false`
Expected: All tests PASS

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linting**

Run: `npm run lint`
Expected: No errors (or fix any that appear)

**Step 4: Manual testing checklist**

- [ ] Login with new server - saves to list
- [ ] Logout - returns to login with server picker
- [ ] Select saved server - immediately connects
- [ ] Password visibility toggle works on login
- [ ] Password visibility toggle works in settings
- [ ] Manage Servers - can see list
- [ ] Manage Servers - can edit server
- [ ] Manage Servers - can delete server
- [ ] Manage Servers - switching works
- [ ] Active server indicator shows correctly

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete multi-server credentials implementation"
```

---

## Summary

This implementation adds:

1. **SavedServer type and storage utilities** - Type-safe server management
2. **AuthContext enhancements** - `savedServers`, `switchServer`, `updateServer`, `deleteServer`
3. **PasswordInput component** - Reusable password field with visibility toggle
4. **Login screen updates** - Saved servers list, password toggle
5. **Settings updates** - Password display, Manage Servers link
6. **Manage Servers screen** - Full CRUD for saved servers

Total new/modified files: 8
Estimated lines of code: ~600
