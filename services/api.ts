import { base64Encode } from "@/utils/base64";
import { normalizeUrl } from "@/utils/url";

export type RepeaterType = "+" | "++" | ".+";
export type RepeaterUnit = "d" | "w" | "m" | "y";

export interface Repeater {
  type: RepeaterType;
  value: number;
  unit: RepeaterUnit;
}

export interface Todo {
  todo: string;
  title: string;
  tags: string[] | null;
  level: number;
  scheduled: string | null;
  scheduledRepeater: Repeater | null;
  deadline: string | null;
  deadlineRepeater: Repeater | null;
  priority: string | null;
  file: string | null;
  pos: number | null;
  id: string | null;
  olpath: string[] | null;
  notifyBefore: number[] | null;
  body?: string | null;
  // Org-mode properties drawer key-value pairs
  properties?: Record<string, string> | null;
  // Habit fields (present when isWindowHabit is true)
  isWindowHabit?: boolean;
  habitSummary?: HabitSummary;
}

export interface AgendaEntry extends Todo {
  agendaLine: string;
  completedAt?: string | null;
}

// Habit types
export interface MiniGraphEntry {
  date: string;
  conformingRatio: number;
  completed: boolean;
  completionNeededToday?: boolean;
}

export interface HabitSummary {
  conformingRatio: number;
  completionNeededToday: boolean;
  nextRequiredInterval: string;
  completionsInWindow: number;
  targetRepetitions: number;
  miniGraph: MiniGraphEntry[];
}

export interface HabitConfig {
  status: string;
  enabled: boolean;
  colors?: {
    conforming: string;
    notConforming: string;
    requiredCompletionForeground: string;
    nonRequiredCompletionForeground: string;
    requiredCompletionTodayForeground: string;
  };
  display?: {
    precedingIntervals: number;
    followingDays: number;
    completionNeededTodayGlyph: string;
    completedGlyph: string;
  };
}

export interface HabitStatusGraphEntry {
  date: string;
  assessmentStart: string;
  assessmentEnd: string;
  conformingRatioWithout: number;
  conformingRatioWith: number;
  completionCount: number;
  status: "past" | "present" | "future";
  completionExpectedToday: boolean;
}

export interface HabitStatus {
  status: string;
  id: string;
  title: string;
  habit: {
    assessmentInterval: Record<string, number>;
    rescheduleInterval: Record<string, number>;
    rescheduleThreshold: number;
    maxRepetitionsPerInterval: number;
    startTime: string;
    windowSpecs: {
      duration: Record<string, number>;
      targetRepetitions: number;
      conformingValue: number;
    }[];
  };
  currentState: HabitSummary;
  doneTimes: string[];
  graph: HabitStatusGraphEntry[];
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

export interface CompleteTodoResponse {
  status: string;
  title?: string;
  oldState?: string;
  newState?: string;
  message?: string;
}

export interface TodoUpdates {
  title?: string;
  scheduled?: string | null;
  scheduledRepeater?: Repeater | null;
  deadline?: string | null;
  deadlineRepeater?: Repeater | null;
  priority?: string | null;
  body?: string | null;
  properties?: Record<string, string> | null;
}

export interface UpdateTodoResponse {
  status: string;
  title?: string;
  updates?: TodoUpdates;
  message?: string;
}

export interface DeleteTodoResponse {
  deleted?: boolean;
  status?: string;
  title?: string;
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

export interface CategoryType {
  name: string;
  hasCategories: boolean;
  captureTemplate: string;
  prompts: TemplatePrompt[];
}

export interface CategoryTypesResponse {
  types: CategoryType[];
}

export interface CategoriesResponse {
  type: string;
  categories: string[];
  todoFiles: string[];
}

export interface CategoryCaptureResponse {
  status: string;
  category?: string;
  title?: string;
  file?: string;
  pos?: number;
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

export interface VersionResponse {
  version: string;
  gitCommit: string;
}

export interface AgendaFileInfo {
  path: string;
  exists: boolean;
  readable: boolean;
}

export interface AgendaFilesResponse {
  count: number;
  files: AgendaFileInfo[];
}

export interface FilterOptionsResponse {
  todoStates: string[];
  priorities: string[];
  tags: string[];
  categories: string[];
}

export interface MetadataResponse {
  templates: TemplatesResponse | null;
  filterOptions: FilterOptionsResponse | null;
  todoStates: TodoStatesResponse | null;
  customViews: CustomViewsResponse | null;
  errors: string[];
}

class OrgAgendaApi {
  private baseUrl: string = "";
  private authHeader: string = "";
  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  configure(baseUrl: string, username: string, password: string) {
    this.baseUrl = normalizeUrl(baseUrl);
    this.authHeader = `Basic ${base64Encode(`${username}:${password}`)}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    if (!this.baseUrl) {
      throw new Error("API not configured: baseUrl is empty");
    }

    if (!this.authHeader) {
      throw new Error("API not configured: authHeader is empty");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error(`API error: ${response.status}`);
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("[API] JSON parse error", {
        url,
        body: text.substring(0, 500),
      });
      throw parseError;
    }
  }

  async getAgenda(
    span: "day" | "week" = "day",
    date?: string,
    includeOverdue?: boolean,
    includeCompleted?: boolean,
  ): Promise<AgendaResponse> {
    const params = new URLSearchParams({ span });
    if (date) {
      params.append("date", date);
    }
    if (includeOverdue !== undefined) {
      params.append("include_overdue", includeOverdue ? "true" : "false");
    }
    if (includeCompleted) {
      params.append("include_completed", "true");
    }
    return this.request<AgendaResponse>(`/agenda?${params.toString()}`);
  }

  async getAllTodos(): Promise<GetAllTodosResponse> {
    return this.request<GetAllTodosResponse>("/get-all-todos");
  }

  async completeTodo(
    todo: Todo,
    newState: string = "DONE",
  ): Promise<CompleteTodoResponse> {
    const identifier = todo.id
      ? { id: todo.id }
      : { file: todo.file, pos: todo.pos, title: todo.title };
    return this.request<CompleteTodoResponse>("/complete", {
      method: "POST",
      body: JSON.stringify({
        ...identifier,
        state: newState,
      }),
    });
  }

  async updateTodo(
    todo: Todo,
    updates: TodoUpdates,
  ): Promise<UpdateTodoResponse> {
    // Use id if available, otherwise file/pos for identification
    // Note: we don't include title in the identifier because it could conflict
    // with title updates. Backend uses file+pos to locate the todo.
    const identifier = todo.id
      ? { id: todo.id }
      : { file: todo.file, pos: todo.pos };
    return this.request<UpdateTodoResponse>("/update", {
      method: "POST",
      body: JSON.stringify({
        ...identifier,
        ...updates,
      }),
    });
  }

  async deleteTodo(todo: Todo): Promise<DeleteTodoResponse> {
    const identifier = todo.id
      ? { id: todo.id }
      : { file: todo.file, pos: todo.pos, title: todo.title };
    return this.request<DeleteTodoResponse>("/delete", {
      method: "POST",
      body: JSON.stringify({
        ...identifier,
        include_children: true,
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
    const identifier = todo.id
      ? { id: todo.id }
      : { file: todo.file, pos: todo.pos, title: todo.title };
    return this.request<CompleteTodoResponse>("/complete", {
      method: "POST",
      body: JSON.stringify({
        ...identifier,
        state: newState,
      }),
    });
  }

  async getTemplates(): Promise<TemplatesResponse> {
    return this.request<TemplatesResponse>("/capture-templates");
  }

  async capture(
    template: string,
    values: Record<string, string | string[] | Repeater>,
  ): Promise<CaptureResponse> {
    return this.request<CaptureResponse>("/capture", {
      method: "POST",
      body: JSON.stringify({ template, values }),
    });
  }

  async createTodo(title: string): Promise<CaptureResponse> {
    return this.capture("default", { Title: title });
  }

  async getCustomViews(): Promise<CustomViewsResponse> {
    return this.request<CustomViewsResponse>("/custom-views");
  }

  async getCustomView(key: string): Promise<CustomViewResponse> {
    return this.request<CustomViewResponse>(
      `/custom-view?key=${encodeURIComponent(key)}`,
    );
  }

  async getVersion(): Promise<VersionResponse> {
    return this.request<VersionResponse>("/version");
  }

  async getAgendaFiles(): Promise<AgendaFilesResponse> {
    return this.request<AgendaFilesResponse>("/agenda-files");
  }

  async getFilterOptions(): Promise<FilterOptionsResponse> {
    return this.request<FilterOptionsResponse>("/filter-options");
  }

  async getMetadata(): Promise<MetadataResponse> {
    return this.request<MetadataResponse>("/metadata");
  }

  async getCategoryTypes(): Promise<CategoryTypesResponse> {
    return this.request<CategoryTypesResponse>("/category-types");
  }

  async getCategories(type: string): Promise<CategoriesResponse> {
    return this.request<CategoriesResponse>(
      `/categories?type=${encodeURIComponent(type)}`,
    );
  }

  async categoryCapture(
    type: string,
    category: string,
    values: Record<string, string | string[]>,
  ): Promise<CategoryCaptureResponse> {
    const { title, ...rest } = values;
    return this.request<CategoryCaptureResponse>("/category-capture", {
      method: "POST",
      body: JSON.stringify({
        type,
        category,
        title,
        ...rest,
      }),
    });
  }

  async getHabitConfig(): Promise<HabitConfig> {
    return this.request<HabitConfig>("/habit-config");
  }

  async getHabitStatus(
    id: string,
    preceding?: number,
    following?: number,
  ): Promise<HabitStatus> {
    const params = new URLSearchParams({ id });
    if (preceding !== undefined) {
      params.append("preceding", preceding.toString());
    }
    if (following !== undefined) {
      params.append("following", following.toString());
    }
    return this.request<HabitStatus>(`/habit-status?${params.toString()}`);
  }
}

export const api = new OrgAgendaApi();
