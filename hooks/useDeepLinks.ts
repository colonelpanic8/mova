import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

interface DeepLinkParams {
  title?: string;
  id?: string;
  file?: string;
  pos?: string;
  state?: string;
}

function parseDeepLink(
  url: string,
): { action: string; params: DeepLinkParams } | null {
  try {
    const parsed = Linking.parse(url);
    // URL format: mova://action?params
    // e.g., mova://create?title=Buy+milk
    // e.g., mova://complete?id=abc123
    const action = parsed.path || parsed.hostname || "";
    const params: DeepLinkParams = {};

    if (parsed.queryParams) {
      if (parsed.queryParams.title)
        params.title = String(parsed.queryParams.title);
      if (parsed.queryParams.id) params.id = String(parsed.queryParams.id);
      if (parsed.queryParams.file)
        params.file = String(parsed.queryParams.file);
      if (parsed.queryParams.pos) params.pos = String(parsed.queryParams.pos);
      if (parsed.queryParams.state)
        params.state = String(parsed.queryParams.state);
    }

    return { action, params };
  } catch {
    return null;
  }
}

export function useDeepLinks() {
  const router = useRouter();
  const { isAuthenticated, apiUrl, username, password } = useAuth();
  const processedUrls = useRef<Set<string>>(new Set());

  const handleUrl = async (url: string) => {
    // Prevent processing the same URL twice
    if (processedUrls.current.has(url)) return;
    processedUrls.current.add(url);

    const parsed = parseDeepLink(url);
    if (!parsed) return;

    const { action, params } = parsed;

    if (!isAuthenticated) {
      return;
    }

    if (!apiUrl || !username || !password) return;

    api.configure(apiUrl, username, password);

    switch (action) {
      case "create":
        if (params.title) {
          try {
            await api.capture("default", { Title: params.title });
            Alert.alert("Todo created", params.title);
          } catch (err) {
            Alert.alert("Error", "Failed to create todo");
          }
        } else {
          // Navigate to capture tab if no title provided
          router.push("/(tabs)/capture");
        }
        break;

      case "complete":
        if (params.id || (params.file && params.pos)) {
          try {
            const result = await api.completeTodo(
              {
                id: params.id || null,
                file: params.file || null,
                pos: params.pos ? parseInt(params.pos, 10) : null,
                title: params.title || "",
                todo: "",
                tags: null,
                level: 0,
                scheduled: null,
                deadline: null,
                priority: null,
                olpath: null,
                notifyBefore: null,
              },
              params.state || "DONE",
            );

            if (result.status === "completed") {
              Alert.alert("Completed", result.title || "Todo completed");
            } else {
              Alert.alert("Error", result.message || "Failed to complete");
            }
          } catch (err) {
            Alert.alert("Error", "Failed to complete todo");
          }
        }
        break;

      case "search":
        router.push("/(tabs)/search");
        break;

      case "agenda":
        router.push("/(tabs)");
        break;

      default:
        // Unknown action - just open the app
        break;
    }
  };

  useEffect(() => {
    // Handle URL that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle URLs while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [isAuthenticated, apiUrl, username, password]);
}
