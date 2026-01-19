export interface SavedServer {
  id: string;
  nickname?: string;
  apiUrl: string;
  username: string;
  password: string;
}

export type SavedServerInput = Omit<SavedServer, "id">;
