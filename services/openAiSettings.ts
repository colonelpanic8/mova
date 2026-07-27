import { deleteSecret, getSecret, setSecret } from "@/utils/secretStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OPENAI_API_KEY = "mova_openai_api_key";
const OPENAI_MODEL = "mova_openai_model";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

export interface OpenAiSettings {
  apiKey: string;
  model: string;
}

export async function getOpenAiSettings(): Promise<OpenAiSettings | null> {
  const [apiKey, storedModel] = await Promise.all([
    getSecret(OPENAI_API_KEY),
    AsyncStorage.getItem(OPENAI_MODEL),
  ]);
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    model: storedModel?.trim() || DEFAULT_OPENAI_MODEL,
  };
}

export async function saveOpenAiSettings(
  settings: OpenAiSettings,
): Promise<void> {
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim() || DEFAULT_OPENAI_MODEL;
  if (!apiKey) {
    throw new Error("An OpenAI API key is required");
  }
  await Promise.all([
    setSecret(OPENAI_API_KEY, apiKey),
    AsyncStorage.setItem(OPENAI_MODEL, model),
  ]);
}

export async function clearOpenAiSettings(): Promise<void> {
  await Promise.all([
    deleteSecret(OPENAI_API_KEY),
    AsyncStorage.removeItem(OPENAI_MODEL),
  ]);
}
