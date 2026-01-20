import { api } from "@/services/api";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Habit API methods", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    api.configure("http://localhost:8080", "user", "pass");
  });

  describe("getHabitConfig", () => {
    it("fetches habit configuration", async () => {
      const mockResponse = {
        status: "ok",
        enabled: true,
        colors: {
          conforming: "#4d7085",
          notConforming: "#d40d0d",
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getHabitConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-config",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
      expect(result.enabled).toBe(true);
      expect(result.colors?.conforming).toBe("#4d7085");
    });
  });

  describe("getHabitStatus", () => {
    it("fetches habit status with id", async () => {
      const mockResponse = {
        status: "ok",
        id: "habit-123",
        title: "Exercise",
        graph: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getHabitStatus("habit-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-status?id=habit-123",
        expect.any(Object)
      );
      expect(result.id).toBe("habit-123");
    });

    it("includes optional preceding and following params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ status: "ok" })),
      });

      await api.getHabitStatus("habit-123", 10, 5);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/habit-status?id=habit-123&preceding=10&following=5",
        expect.any(Object)
      );
    });
  });
});
