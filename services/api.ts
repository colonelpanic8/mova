import { base64Encode } from "@/utils/base64";

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

export interface CreateTodoOptions {
  scheduled?: string;
  deadline?: string;
  priority?: string;
  tags?: string[];
  todo?: string;
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

export interface TemplatePrompt {
  name: string;
  type: "string" | "date" | "tags";
  required: boolean;
}

export interface Template {
  name: string;
  prompts: TemplatePrompt[];
}

export interface TemplatesResponse {
  [key: string]: Template;
}

export interface CaptureResponse {
  status: string;
  template?: string;
  message?: string;
}

export interface CustomView {
  key: string;
  name: string;
}

export interface CustomViewsResponse {
  views: CustomView[];
}

export interface CustomViewResponse {
  key: string;
  name: string;
  entries: AgendaEntry[];
}

export interface AgendaFile {
  path: string;
  exists: boolean;
  readable: boolean;
}

export interface AgendaFilesResponse {
  count: number;
  files: AgendaFile[];
}

class OrgAgendaApi {
  private baseUrl: string = "";
  private authHeader: string = "";

  configure(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.authHeader = `Basic ${base64Encode(`${username}:${password}`)}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async getAgenda(
    span: "day" | "week" = "day",
    date?: string,
    includeOverdue?: boolean,
  ): Promise<AgendaResponse> {
    const params = new URLSearchParams({ span });
    if (date) {
      params.append("date", date);
    }
    if (includeOverdue !== undefined) {
      params.append("include_overdue", includeOverdue ? "true" : "false");
    }
    return this.request<AgendaResponse>(`/agenda?${params.toString()}`);
  }

  async getAllTodos(): Promise<GetAllTodosResponse> {
    return this.request<GetAllTodosResponse>("/get-all-todos");
  }

  async createTodo(
    title: string,
    options?: CreateTodoOptions,
  ): Promise<CreateTodoResponse> {
    return this.request<CreateTodoResponse>("/create-todo", {
      method: "POST",
      body: JSON.stringify({ title, ...options }),
    });
  }

  async completeTodo(
    todo: Todo,
    newState: string = "DONE",
  ): Promise<CompleteTodoResponse> {
    return this.request<CompleteTodoResponse>("/complete", {
      method: "POST",
      body: JSON.stringify({
        id: todo.id,
        file: todo.file,
        pos: todo.pos,
        title: todo.title,
        state: newState,
      }),
    });
  }

  async updateTodo(
    todo: Todo,
    updates: TodoUpdates,
  ): Promise<UpdateTodoResponse> {
    return this.request<UpdateTodoResponse>("/update", {
      method: "POST",
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
    return this.request<TodoStatesResponse>("/todo-states");
  }

  async setTodoState(
    todo: Todo,
    newState: string,
  ): Promise<CompleteTodoResponse> {
    return this.request<CompleteTodoResponse>("/complete", {
      method: "POST",
      body: JSON.stringify({
        id: todo.id,
        file: todo.file,
        pos: todo.pos,
        title: todo.title,
        state: newState,
      }),
    });
  }

  async getTemplates(): Promise<TemplatesResponse> {
    return this.request<TemplatesResponse>("/templates");
  }

  async capture(
    template: string,
    values: Record<string, string | string[]>,
  ): Promise<CaptureResponse> {
    return this.request<CaptureResponse>("/capture", {
      method: "POST",
      body: JSON.stringify({ template, values }),
    });
  }

  async getCustomViews(): Promise<CustomViewsResponse> {
    return this.request<CustomViewsResponse>("/custom-views");
  }

  async getCustomView(key: string): Promise<CustomViewResponse> {
    return this.request<CustomViewResponse>(
      `/custom-view?key=${encodeURIComponent(key)}`,
    );
  }

  async getAgendaFiles(): Promise<AgendaFilesResponse> {
    return this.request<AgendaFilesResponse>("/agenda-files");
  }
}

export const api = new OrgAgendaApi();
