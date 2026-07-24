import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteServer,
  getActiveServerId,
  getSavedServers,
  saveServer,
  setActiveServerId,
  updateServer,
} from "../../utils/serverStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../utils/secretStore", () => ({
  getSecret: jest.fn(),
  setSecret: jest.fn(),
  deleteSecret: jest.fn(),
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
        {
          id: "1",
          apiUrl: "https://server1.com",
          username: "user1",
          password: "pass1",
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockServers),
      );
      const { getSecret, setSecret } = jest.requireMock(
        "../../utils/secretStore",
      );
      (getSecret as jest.Mock).mockResolvedValue("pass1");
      const servers = await getSavedServers();
      expect(setSecret).toHaveBeenCalled();
      expect(servers).toEqual([
        {
          id: "1",
          apiUrl: "https://server1.com",
          username: "user1",
          hasPassword: true,
        },
      ]);
    });
  });

  describe("saveServer", () => {
    it("should add new server with generated id", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const { setSecret } = jest.requireMock("../../utils/secretStore");
      const server = await saveServer({
        apiUrl: "https://new.com",
        username: "user",
        password: "pass",
      });
      expect(server.id).toBeDefined();
      expect(setSecret).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("updateServer", () => {
    it("should update server by id", async () => {
      const mockServers = [
        {
          id: "1",
          apiUrl: "https://server1.com",
          username: "user1",
          password: "pass1",
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockServers),
      );
      const { getSecret } = jest.requireMock("../../utils/secretStore");
      (getSecret as jest.Mock).mockResolvedValue("pass1");
      await updateServer("1", { nickname: "My Server" });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_saved_servers",
        JSON.stringify([
          {
            id: "1",
            apiUrl: "https://server1.com",
            username: "user1",
            nickname: "My Server",
          },
        ]),
      );
    });
  });

  describe("deleteServer", () => {
    it("should remove server by id", async () => {
      const mockServers = [
        {
          id: "1",
          apiUrl: "https://server1.com",
          username: "user1",
          password: "pass1",
        },
        {
          id: "2",
          apiUrl: "https://server2.com",
          username: "user2",
          password: "pass2",
        },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockServers),
      );
      const { getSecret, deleteSecret } = jest.requireMock(
        "../../utils/secretStore",
      );
      (getSecret as jest.Mock).mockResolvedValue("pass");
      await deleteServer("1");
      expect(deleteSecret).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_saved_servers",
        JSON.stringify([
          {
            id: "2",
            apiUrl: "https://server2.com",
            username: "user2",
          },
        ]),
      );
    });
  });

  describe("native SecureStore key compatibility", () => {
    // Native SecureStore rejects keys outside this charset. The mock enforces
    // it so any key regression fails here instead of only on-device.
    const VALID_KEY = /^[\w.-]+$/;
    let secretMap: Map<string, string>;

    function invalidKey(key: string) {
      return Promise.reject(
        new Error(
          `Invalid key provided to SecureStore: ${key}. Keys must not be ` +
            'empty and contain only alphanumeric characters, ".", "-", and "_".',
        ),
      );
    }

    beforeEach(() => {
      secretMap = new Map();
      const { getSecret, setSecret, deleteSecret } = jest.requireMock(
        "../../utils/secretStore",
      );
      (getSecret as jest.Mock).mockImplementation((key: string) =>
        VALID_KEY.test(key)
          ? Promise.resolve(secretMap.get(key) ?? null)
          : invalidKey(key),
      );
      (setSecret as jest.Mock).mockImplementation(
        (key: string, value: string) => {
          if (!VALID_KEY.test(key)) return invalidKey(key);
          secretMap.set(key, value);
          return Promise.resolve();
        },
      );
      (deleteSecret as jest.Mock).mockImplementation((key: string) => {
        if (!VALID_KEY.test(key)) return invalidKey(key);
        secretMap.delete(key);
        return Promise.resolve();
      });
    });

    it("saveServer stores the password under a key native SecureStore accepts", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const server = await saveServer({
        apiUrl: "https://server1.com",
        username: "user1",
        password: "pass1",
      });
      expect(secretMap.get(`mova_server_password.${server.id}`)).toBe("pass1");
    });

    it("getSavedServers migrates plaintext passwords without wiping the list", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: "abc123",
            apiUrl: "https://server1.com",
            username: "user1",
            password: "pass1",
          },
        ]),
      );

      const servers = await getSavedServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].hasPassword).toBe(true);
      expect(secretMap.get("mova_server_password.abc123")).toBe("pass1");
    });

    it("keeps the server list readable when a password migration fails", async () => {
      const { setSecret } = jest.requireMock("../../utils/secretStore");
      (setSecret as jest.Mock).mockRejectedValue(
        new Error("storage unavailable"),
      );
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: "abc123",
            apiUrl: "https://server1.com",
            username: "user1",
            password: "pass1",
          },
        ]),
      );

      const servers = await getSavedServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].hasPassword).toBe(true);
      // The plaintext copy must survive (no rewrite) so migration can retry.
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("migrates web-stored passwords from the legacy colon-prefixed key", async () => {
      // Web's AsyncStorage backend accepted the colon key; emulate it with a
      // permissive store seeded with a legacy entry.
      secretMap.set("mova_server_password:abc123", "pass1");
      const { getSecret, setSecret, deleteSecret } = jest.requireMock(
        "../../utils/secretStore",
      );
      (getSecret as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(secretMap.get(key) ?? null),
      );
      (setSecret as jest.Mock).mockImplementation(
        (key: string, value: string) => {
          secretMap.set(key, value);
          return Promise.resolve();
        },
      );
      (deleteSecret as jest.Mock).mockImplementation((key: string) => {
        secretMap.delete(key);
        return Promise.resolve();
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { id: "abc123", apiUrl: "https://server1.com", username: "user1" },
        ]),
      );

      const servers = await getSavedServers();

      expect(servers[0].hasPassword).toBe(true);
      expect(secretMap.get("mova_server_password.abc123")).toBe("pass1");
    });
  });

  describe("getActiveServerId", () => {
    it("should return stored active server id", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("server-123");
      const id = await getActiveServerId();
      expect(id).toBe("server-123");
    });

    it("should return null when no active server", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const id = await getActiveServerId();
      expect(id).toBeNull();
    });
  });

  describe("setActiveServerId", () => {
    it("should store active server id", async () => {
      await setActiveServerId("server-123");
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_active_server_id",
        "server-123",
      );
    });

    it("should remove active server id when null", async () => {
      await setActiveServerId(null);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        "mova_active_server_id",
      );
    });
  });
});
