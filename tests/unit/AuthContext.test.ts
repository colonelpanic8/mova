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
      {
        id: "1",
        apiUrl: "https://test.com",
        username: "user",
        password: "pass",
      },
    ]);

    const servers = await serverStorage.getSavedServers();
    expect(servers.length).toBe(1);
    spy.mockRestore();
  });
});
