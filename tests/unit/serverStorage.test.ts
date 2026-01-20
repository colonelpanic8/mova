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
      await updateServer("1", { nickname: "My Server" });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_saved_servers",
        JSON.stringify([{ ...mockServers[0], nickname: "My Server" }]),
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
      await deleteServer("1");
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "mova_saved_servers",
        JSON.stringify([mockServers[1]]),
      );
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
