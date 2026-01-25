import { api } from "../../services/api";

// Mock fetch globally
global.fetch = jest.fn();

describe("OrgAgendaApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.configure("http://test-api.local", "testuser", "testpass");
  });

  describe("configure", () => {
    it("should set base URL and auth header", () => {
      // The configure method sets private properties, so we test through behavior
      expect(() =>
        api.configure("http://new-url", "user", "pass"),
      ).not.toThrow();
    });
  });

  describe("getAllTodos", () => {
    it("should make GET request to /get-all-todos", async () => {
      const mockResponse = {
        todos: [{ id: "1", title: "Test", todo: "TODO" }],
        defaults: { notifyBefore: [30] },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getAllTodos();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/get-all-todos",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(api.getAllTodos()).rejects.toThrow("API error: 401");
    });
  });

  describe("capture", () => {
    it("should make POST request to /capture with template and values", async () => {
      const mockResponse = { status: "created", template: "default" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.capture("default", { Title: "New Todo" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/capture",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            template: "default",
            values: { Title: "New Todo" },
          }),
        }),
      );
      expect(result.status).toBe("created");
    });
  });

  describe("completeTodo", () => {
    it("should send only id when todo has id", async () => {
      const todo = {
        id: "test-id-123",
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent", "Child"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "completed", newState: "DONE" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.completeTodo(todo);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        id: "test-id-123",
        state: "DONE",
      });
      // Should NOT include olpath, file, pos, title when id is present
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("file");
      expect(callBody).not.toHaveProperty("pos");
      expect(callBody).not.toHaveProperty("title");
    });

    it("should send file/pos/title when todo has no id", async () => {
      const todo = {
        id: null,
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent", "Child"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "completed", newState: "DONE" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.completeTodo(todo);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        file: "/test.org",
        pos: 100,
        title: "Test Task",
        state: "DONE",
      });
      // Should NOT include olpath even when no id
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("id");
    });
  });

  describe("getAgenda", () => {
    it("should make GET request to /agenda with span parameter", async () => {
      const mockResponse = {
        span: "day",
        date: "2024-06-15",
        entries: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getAgenda("day");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/agenda?span=day",
        expect.any(Object),
      );
      expect(result.span).toBe("day");
    });

    it("should support week span", async () => {
      const mockResponse = { span: "week", date: "2024-06-15", entries: [] };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.getAgenda("week");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/agenda?span=week",
        expect.any(Object),
      );
    });
  });

  describe("updateTodo", () => {
    it("should send only id plus updates when todo has id", async () => {
      const todo = {
        id: "test-id-456",
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const updates = {
        scheduled: { date: "2024-06-20" },
        priority: "A",
      };

      const mockResponse = { status: "updated" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.updateTodo(todo, updates);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        id: "test-id-456",
        scheduled: { date: "2024-06-20" },
        priority: "A",
      });
      // Should NOT include olpath, file, pos, title when id is present
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("file");
      expect(callBody).not.toHaveProperty("pos");
      expect(callBody).not.toHaveProperty("title");
    });

    it("should send file/pos/title plus updates when todo has no id", async () => {
      const todo = {
        id: null,
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const updates = {
        deadline: { date: "2024-07-01" },
      };

      const mockResponse = { status: "updated" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.updateTodo(todo, updates);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        file: "/test.org",
        pos: 100,
        deadline: { date: "2024-07-01" },
      });
      // Should NOT include olpath
      expect(callBody).not.toHaveProperty("olpath");
    });

    it("should use Timestamp objects for schedule/deadline with repeaters", async () => {
      const todo = {
        id: "test-id",
        title: "Test",
        todo: "TODO",
        file: null,
        pos: null,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: null,
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const updates = {
        scheduled: {
          date: "2024-06-20",
          time: "10:00",
          repeater: { type: "+" as const, value: 1, unit: "w" as const },
        },
        deadline: {
          date: "2024-07-01",
          repeater: { type: "++" as const, value: 2, unit: "d" as const },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ status: "updated" })),
      });

      await api.updateTodo(todo, updates);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      // Verify Timestamp structure is sent correctly
      expect(callBody.scheduled).toEqual({
        date: "2024-06-20",
        time: "10:00",
        repeater: { type: "+", value: 1, unit: "w" },
      });
      expect(callBody.deadline).toEqual({
        date: "2024-07-01",
        repeater: { type: "++", value: 2, unit: "d" },
      });
      // Should NOT have old-style separate repeater fields
      expect(callBody).not.toHaveProperty("scheduledRepeater");
      expect(callBody).not.toHaveProperty("deadlineRepeater");
    });
  });

  describe("deleteTodo", () => {
    it("should send only id when todo has id", async () => {
      const todo = {
        id: "delete-id-789",
        title: "Task to Delete",
        todo: "TODO",
        file: "/test.org",
        pos: 200,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Some", "Path"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "deleted" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.deleteTodo(todo);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({ id: "delete-id-789", include_children: true });
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("file");
      expect(callBody).not.toHaveProperty("pos");
      expect(callBody).not.toHaveProperty("title");
    });

    it("should send file/pos/title when todo has no id", async () => {
      const todo = {
        id: null,
        title: "Task to Delete",
        todo: "TODO",
        file: "/test.org",
        pos: 200,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Some", "Path"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "deleted" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.deleteTodo(todo);

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        file: "/test.org",
        pos: 200,
        title: "Task to Delete",
        include_children: true,
      });
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("id");
    });
  });

  describe("setTodoState", () => {
    it("should send only id plus state when todo has id", async () => {
      const todo = {
        id: "state-id-123",
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "completed", newState: "NEXT" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.setTodoState(todo, "NEXT");

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        id: "state-id-123",
        state: "NEXT",
      });
      expect(callBody).not.toHaveProperty("olpath");
      expect(callBody).not.toHaveProperty("file");
    });

    it("should send file/pos/title plus state when todo has no id", async () => {
      const todo = {
        id: null,
        title: "Test Task",
        todo: "TODO",
        file: "/test.org",
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: ["Parent"],
        notifyBefore: null,
        category: null,
        effectiveCategory: null,
      };

      const mockResponse = { status: "completed", newState: "DONE" };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await api.setTodoState(todo, "DONE");

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody).toEqual({
        file: "/test.org",
        pos: 100,
        title: "Test Task",
        state: "DONE",
      });
      expect(callBody).not.toHaveProperty("olpath");
    });
  });

  describe("getCategoryTypes", () => {
    it("should make GET request to /category-types", async () => {
      const mockResponse = {
        types: [
          {
            name: "projects",
            hasCategories: true,
            captureTemplate: "* TODO %?\n",
            prompts: [{ name: "Title", type: "string", required: true }],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getCategoryTypes();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/category-types",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
          }),
        }),
      );
      expect(result.types).toHaveLength(1);
      expect(result.types[0].name).toBe("projects");
    });
  });

  describe("getCategories", () => {
    it("should make GET request to /categories with type parameter", async () => {
      const mockResponse = {
        type: "projects",
        categories: ["alpha", "beta"],
        todoFiles: ["/path/to/projects.org"],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.getCategories("projects");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/categories?type=projects",
        expect.any(Object),
      );
      expect(result.categories).toEqual(["alpha", "beta"]);
    });
  });

  describe("categoryCapture", () => {
    it("should make POST request to /category-capture", async () => {
      const mockResponse = {
        status: "created",
        category: "alpha",
        title: "New task",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await api.categoryCapture("projects", "alpha", {
        title: "New task",
        todo: "TODO",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.local/category-capture",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            type: "projects",
            category: "alpha",
            title: "New task",
            todo: "TODO",
          }),
        }),
      );
      expect(result.status).toBe("created");
    });
  });
});
