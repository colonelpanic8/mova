// Tests for widget credential storage. widgets/storage.ts talks to a native
// SharedStorage module via react-native; mock both so the module runs in the
// Node unit environment.

const mockStore: Record<string, string> = {};

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  NativeModules: {
    SharedStorage: {
      getItem: jest.fn(async (key: string) =>
        key in mockStore ? mockStore[key] : null,
      ),
      setItem: jest.fn(async (key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete mockStore[key];
      }),
    },
  },
}));

import {
  clearWidgetCredentials,
  getWidgetCredentials,
  saveCredentialsToWidget,
} from "../../widgets/storage";

describe("widget credential storage", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    jest.clearAllMocks();
  });

  it("round-trips credentials through SharedPreferences", async () => {
    await saveCredentialsToWidget("https://org.example.com", "ivan", "hunter2");

    const creds = await getWidgetCredentials();
    expect(creds).toEqual({
      apiUrl: "https://org.example.com",
      username: "ivan",
      password: "hunter2",
    });
  });

  it("returns nulls when nothing is stored", async () => {
    const creds = await getWidgetCredentials();
    expect(creds).toEqual({ apiUrl: null, username: null, password: null });
  });

  it("clears stored credentials on logout", async () => {
    await saveCredentialsToWidget("https://org.example.com", "ivan", "hunter2");
    await clearWidgetCredentials();

    const creds = await getWidgetCredentials();
    expect(creds).toEqual({ apiUrl: null, username: null, password: null });
  });
});
