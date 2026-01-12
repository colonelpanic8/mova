export interface Todo {
  todo: string;
  title: string;
  tags: string[] | null;
  level: number;
  scheduled: string | null;
  deadline: string | null;
}

export interface AgendaResponse {
  span: string;
  date: string;
  entries: string[];
}

export interface CreateTodoResponse {
  status: string;
  title: string;
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

  async getAgenda(span: 'day' | 'week' = 'day'): Promise<AgendaResponse> {
    return this.request<AgendaResponse>(`/agenda?span=${span}`);
  }

  async getAllTodos(): Promise<Todo[]> {
    return this.request<Todo[]>('/get-all-todos');
  }

  async createTodo(title: string): Promise<CreateTodoResponse> {
    return this.request<CreateTodoResponse>('/create-todo', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }
}

export const api = new OrgAgendaApi();
