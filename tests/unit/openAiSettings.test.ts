import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearOpenAiSettings,
  DEFAULT_OPENAI_MODEL,
  getOpenAiSettings,
  saveOpenAiSettings,
} from "../../services/openAiSettings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../utils/secretStore", () => ({
  getSecret: jest.fn(),
  setSecret: jest.fn(),
  deleteSecret: jest.fn(),
}));

describe("OpenAI settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the watch-optimized default model when only a key is stored", async () => {
    const { getSecret } = jest.requireMock("../../utils/secretStore");
    (getSecret as jest.Mock).mockResolvedValue("sk-test");
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await expect(getOpenAiSettings()).resolves.toEqual({
      apiKey: "sk-test",
      model: DEFAULT_OPENAI_MODEL,
    });
  });

  it("stores a trimmed key and model", async () => {
    const { setSecret } = jest.requireMock("../../utils/secretStore");

    await saveOpenAiSettings({
      apiKey: "  sk-test  ",
      model: "  gpt-5.6-luna  ",
    });

    expect(setSecret).toHaveBeenCalledWith("mova_openai_api_key", "sk-test");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "mova_openai_model",
      "gpt-5.6-luna",
    );
  });

  it("clears both the key and model", async () => {
    const { deleteSecret } = jest.requireMock("../../utils/secretStore");

    await clearOpenAiSettings();

    expect(deleteSecret).toHaveBeenCalledWith("mova_openai_api_key");
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("mova_openai_model");
  });
});
