export interface SavedServer {
  id: string;
  nickname?: string;
  apiUrl: string;
  username: string;
  defaultCaptureTemplate?: string;
  hasPassword?: boolean;
}

export interface SavedServerWithPassword extends SavedServer {
  password: string;
}

export type SavedServerInput = Omit<SavedServerWithPassword, "id">;
