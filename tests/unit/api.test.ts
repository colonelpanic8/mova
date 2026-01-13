import { api } from '../../services/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('OrgAgendaApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.configure('http://test-api.local', 'testuser', 'testpass');
  });

  describe('configure', () => {
    it('should set base URL and auth header', () => {
      // The configure method sets private properties, so we test through behavior
      expect(() => api.configure('http://new-url', 'user', 'pass')).not.toThrow();
    });
  });

  describe('getAllTodos', () => {
    it('should make GET request to /get-all-todos', async () => {
      const mockResponse = {
        todos: [{ id: '1', title: 'Test', todo: 'TODO' }],
        defaults: { notifyBefore: [30] },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.getAllTodos();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/get-all-todos',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(api.getAllTodos()).rejects.toThrow('API error: 401');
    });
  });

  describe('createTodo', () => {
    it('should make POST request to /create-todo with title', async () => {
      const mockResponse = { status: 'created', title: 'New Todo' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.createTodo('New Todo');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/create-todo',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'New Todo' }),
        })
      );
      expect(result.status).toBe('created');
    });
  });

  describe('completeTodo', () => {
    it('should make POST request to /complete with todo info', async () => {
      const todo = {
        id: '1',
        title: 'Test Task',
        todo: 'TODO',
        file: '/test.org',
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: null,
        notifyBefore: null,
      };

      const mockResponse = { status: 'completed', newState: 'DONE' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.completeTodo(todo);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/complete',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test Task'),
        })
      );
      expect(result.status).toBe('completed');
      expect(result.newState).toBe('DONE');
    });
  });

  describe('getAgenda', () => {
    it('should make GET request to /agenda with span parameter', async () => {
      const mockResponse = {
        span: 'day',
        date: '2024-06-15',
        entries: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.getAgenda('day');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/agenda?span=day',
        expect.any(Object)
      );
      expect(result.span).toBe('day');
    });

    it('should support week span', async () => {
      const mockResponse = { span: 'week', date: '2024-06-15', entries: [] };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await api.getAgenda('week');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/agenda?span=week',
        expect.any(Object)
      );
    });
  });

  describe('updateTodo', () => {
    it('should make POST request to /update with updates', async () => {
      const todo = {
        id: '1',
        title: 'Test Task',
        todo: 'TODO',
        file: '/test.org',
        pos: 100,
        level: 1,
        tags: null,
        scheduled: null,
        deadline: null,
        priority: null,
        olpath: null,
        notifyBefore: null,
      };

      const updates = {
        scheduled: '2024-06-20',
        priority: 'A',
      };

      const mockResponse = { status: 'updated' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.updateTodo(todo, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.local/update',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('2024-06-20'),
        })
      );
      expect(result.status).toBe('updated');
    });
  });
});
