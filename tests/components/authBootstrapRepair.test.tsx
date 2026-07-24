/**
 * Regression tests for repairing the active-server linkage on startup.
 *
 * Sessions from older app versions can have stored credentials without a
 * saved-server entry, or an active server id pointing at a server that no
 * longer exists. Settings stored on the active server (default capture
 * template, watch custom view) then silently failed to save.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { AuthProvider, useAuth } from "../../context/AuthContext";

const mockAsyncStore = new Map<string, string>();
const mockSecretStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStore.get(key) ?? null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockAsyncStore.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("../../utils/secretStore", () => ({
  getSecret: jest.fn((key: string) =>
    Promise.resolve(mockSecretStore.get(key) ?? null),
  ),
  setSecret: jest.fn((key: string, value: string) => {
    mockSecretStore.set(key, value);
    return Promise.resolve();
  }),
  deleteSecret: jest.fn((key: string) => {
    mockSecretStore.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("../../widgets/storage", () => ({
  saveCredentialsToWidget: jest.fn().mockResolvedValue(undefined),
  clearWidgetCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
}));

function seedCredentials() {
  mockSecretStore.set("mova_api_url", "https://server1.com");
  mockSecretStore.set("mova_username", "user1");
  mockSecretStore.set("mova_password", "pass1");
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      })
    }
  >
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

async function renderAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  return result;
}

describe("active-server repair on startup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStore.clear();
    mockSecretStore.clear();
  });

  it("adopts a saved server matching stored credentials when no active id is set", async () => {
    seedCredentials();
    mockAsyncStore.set(
      "mova_saved_servers",
      JSON.stringify([
        { id: "srv1", apiUrl: "https://server1.com", username: "user1" },
      ]),
    );
    mockSecretStore.set("mova_server_password:srv1", "pass1");

    const result = await renderAuth();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.activeServerId).toBe("srv1");
    expect(mockAsyncStore.get("mova_active_server_id")).toBe("srv1");
  });

  it("re-points a stale active id at the server matching stored credentials", async () => {
    seedCredentials();
    mockAsyncStore.set("mova_active_server_id", "deleted-server");
    mockAsyncStore.set(
      "mova_saved_servers",
      JSON.stringify([
        { id: "srv1", apiUrl: "https://server1.com", username: "user1" },
      ]),
    );
    mockSecretStore.set("mova_server_password:srv1", "pass1");

    const result = await renderAuth();

    expect(result.current.activeServerId).toBe("srv1");
    expect(mockAsyncStore.get("mova_active_server_id")).toBe("srv1");
  });

  it("creates a saved server from stored credentials when none exists, so per-server settings persist", async () => {
    seedCredentials();

    const result = await renderAuth();

    const created = result.current.savedServers.find(
      (s) => s.apiUrl === "https://server1.com" && s.username === "user1",
    );
    expect(created).toBeDefined();
    expect(result.current.activeServerId).toBe(created!.id);

    // The previously-broken flow: saving a per-server setting from the
    // settings screen must actually persist.
    await act(async () => {
      await result.current.updateServer(result.current.activeServerId!, {
        defaultCaptureTemplate: "todo",
      });
    });
    const stored = JSON.parse(mockAsyncStore.get("mova_saved_servers")!);
    expect(stored[0].defaultCaptureTemplate).toBe("todo");
  });

  it("keeps a valid active id untouched", async () => {
    seedCredentials();
    mockAsyncStore.set("mova_active_server_id", "srv2");
    mockAsyncStore.set(
      "mova_saved_servers",
      JSON.stringify([
        { id: "srv1", apiUrl: "https://server1.com", username: "user1" },
        { id: "srv2", apiUrl: "https://server1.com", username: "user1" },
      ]),
    );
    mockSecretStore.set("mova_server_password:srv1", "pass1");
    mockSecretStore.set("mova_server_password:srv2", "pass1");

    const result = await renderAuth();

    expect(result.current.activeServerId).toBe("srv2");
  });
});
