export interface Todo {
  todo: string;
  title: string;
  tags: string[] | null;
  level: number;
  scheduled: string | null;
  deadline: string | null;
  priority: string | null;
  file: string | null;
  pos: number | null;
  id: string | null;
  olpath: string[] | null;
  notifyBefore: number[] | null;
}

export interface AgendaEntry extends Todo {
  agendaLine: string;
}

export interface NotificationDefaults {
  notifyBefore: number[];
}

export interface GetAllTodosResponse {
  defaults: NotificationDefaults;
  todos: Todo[];
}

export interface AgendaResponse {
  span: string;
  date: string;
  entries: AgendaEntry[];
}

export interface CreateTodoResponse {
  status: string;
  title: string;
}

export interface CompleteTodoResponse {
  status: string;
  title?: string;
  oldState?: string;
  newState?: string;
  message?: string;
}

export interface TodoUpdates {
  scheduled?: string | null;
  deadline?: string | null;
  priority?: string | null;
}

export interface UpdateTodoResponse {
  status: string;
  title?: string;
  updates?: TodoUpdates;
  message?: string;
}

export interface TodoStatesResponse {
  active: string[];
  done: string[];
}

class OrgAgendaApi {
  private baseUrl: string = '';
  private authHeader: string = '';

  configure(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async getAgenda(span: 'day' | 'week' = 'day', date?: string): Promise<AgendaResponse> {
    const params = new URLSearchParams({ span });
    if (date) {
      params.append('date', date);
    }
    return this.request<AgendaResponse>(`/agenda?${params.toString()}`);
  }

  async getAllTodos(): Promise<GetAllTodosResponse> {
    return this.request<GetAllTodosResponse>('/get-all-todos');
  }

  async createTodo(title: string): Promise<CreateTodoResponse> {
    return this.request<CreateTodoResponse>('/create-todo', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async completeTodo(todo: Todo, newState: string = 'DONE'): Promise<CompleteTodoResponse> {
    return this.request<CompleteTodoResponse>('/complete', {
      method: 'POST',
      body: JSON.stringify({
        id: todo.id,
        file: todo.file,
        pos: todo.pos,
        title: todo.title,
        state: newState,
      }),
    });
  }

  async updateTodo(todo: Todo, updates: TodoUpdates): Promise<UpdateTodoResponse> {
    return this.request<UpdateTodoResponse>('/update', {
      method: 'POST',
      body: JSON.stringify({
        id: todo.id,
        file: todo.file,
        pos: todo.pos,
        title: todo.title,
        ...updates,
      }),
    });
  }

  async getTodoStates(): Promise<TodoStatesResponse> {
    return this.request<TodoStatesResponse>('/todo-states');
  }

  async setTodoState(todo: Todo, newState: string): Promise<CompleteTodoResponse> {
    return this.request<CompleteTodoResponse>('/complete', {
      method: 'POST',
      body: JSON.stringify({
        id: todo.id,
        file: todo.file,
        pos: todo.pos,
        title: todo.title,
        state: newState,
      }),
    });
  }
}

export const api = new OrgAgendaApi();
