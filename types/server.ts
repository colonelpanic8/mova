export interface WatchCustomView {
  key: string;
  name: string;
}

export interface SavedServer {
  id: string;
  nickname?: string;
  apiUrl: string;
  username: string;
  defaultCaptureTemplate?: string;
  watchCustomView?: WatchCustomView;
  hasPassword?: boolean;
}

export interface SavedServerWithPassword extends SavedServer {
  password: string;
}

export type SavedServerInput = Omit<SavedServerWithPassword, "id">;
