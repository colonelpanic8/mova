/**
 * Test to verify server switching behavior
 */

import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { ApiProvider, useApi } from "../../context/ApiContext";
import { AuthProvider, useAuth } from "../../context/AuthContext";
import { MutationProvider } from "../../context/MutationContext";

// Mock all external dependencies
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../widgets/storage", () => ({
  saveCredentialsToWidget: jest.fn().mockResolvedValue(undefined),
  clearWidgetCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
}));

// Mock fetch for login validation
global.fetch = jest.fn();

describe("Server Switching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MutationProvider>
      <AuthProvider>
        <ApiProvider>{children}</ApiProvider>
      </AuthProvider>
    </MutationProvider>
  );

  it("should update API client when switching servers", async () => {
    // Track API client changes
    const apiClients: any[] = [];

    const { result } = renderHook(
      () => {
        const auth = useAuth();
        const api = useApi();
        apiClients.push(api);
        return { auth, api };
      },
      { wrapper },
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.auth.isLoading).toBe(false);
    });

    // Login to first server
    await act(async () => {
      await result.current.auth.login(
        "https://server1.com",
        "user1",
        "pass1",
        false,
      );
    });

    const firstApi = result.current.api;
    expect(firstApi).not.toBeNull();

    // Login to second server (simulates switchServer)
    await act(async () => {
      await result.current.auth.login(
        "https://server2.com",
        "user2",
        "pass2",
        false,
      );
    });

    const secondApi = result.current.api;
    expect(secondApi).not.toBeNull();

    // API client should be different instances
    expect(firstApi).not.toBe(secondApi);
  });

  it("should create new API client with correct URL when switching", async () => {
    const { result } = renderHook(
      () => {
        const auth = useAuth();
        const api = useApi();
        return { auth, api };
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.auth.isLoading).toBe(false);
    });

    // Login to first server
    await act(async () => {
      await result.current.auth.login(
        "https://server1.com",
        "user1",
        "pass1",
        false,
      );
    });

    expect(result.current.auth.apiUrl).toBe("https://server1.com");

    // Login to second server
    await act(async () => {
      await result.current.auth.login(
        "https://server2.com",
        "user2",
        "pass2",
        false,
      );
    });

    expect(result.current.auth.apiUrl).toBe("https://server2.com");
  });
});
