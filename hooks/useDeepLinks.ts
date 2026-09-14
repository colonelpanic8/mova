import { useApi } from "@/context/ApiContext";
import { useAuth } from "@/context/AuthContext";
import { useServerDataInvalidation } from "@/hooks/queryKeys";
import {
  buildTodoStub,
  completeTodoWithNotificationSync,
} from "@/services/todoCompletion";
import { parseDeepLink } from "@/utils/deepLinks";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Alert, DeviceEventEmitter } from "react-native";

export function useDeepLinks() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const invalidateServerData = useServerDataInvalidation();
  const processedUrls = useRef<Set<string>>(new Set());
  const initialUrlHandled = useRef(false);

  // Resolves to false when the link could not be acted on yet (not signed
  // in), so the launch URL is retried once auth is ready and not afterwards.
  const handleUrl = useCallback(
    async (url: string): Promise<boolean> => {
      const parsed = parseDeepLink(url);
      if (!parsed) return true;

      const { action, params } = parsed;

      if (!isAuthenticated || !api) {
        return false;
      }

      if (action === "create" || action === "complete") {
        if (processedUrls.current.has(url)) return true;
        processedUrls.current.add(url);
      }

      switch (action) {
        case "create":
          if (params.title) {
            try {
              await api.capture("default", { Title: params.title });
              invalidateServerData();
              Alert.alert("Todo created", params.title);
            } catch {
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
              const todo = buildTodoStub({
                id: params.id || null,
                file: params.file || null,
                pos: params.pos ? parseInt(params.pos, 10) : null,
                title: params.title || "",
              });
              const result = await completeTodoWithNotificationSync(
                api,
                todo,
                params.state || "DONE",
              );

              if (result.status === "completed") {
                invalidateServerData();
                Alert.alert("Completed", result.title || "Todo completed");
              } else {
                Alert.alert("Error", result.message || "Failed to complete");
              }
            } catch {
              Alert.alert("Error", "Failed to complete todo");
            }
          }
          break;

        case "open": {
          try {
            const { todos } = await api.getAllTodos();
            let todo;

            if (params.id) {
              todo = todos.find((candidate) => candidate.id === params.id);
            } else if (params.file && params.pos) {
              const pos = Number(params.pos);
              if (Number.isInteger(pos)) {
                todo = todos.find(
                  (candidate) =>
                    candidate.file === params.file && candidate.pos === pos,
                );
              }
            } else if (params.title && !params.file && !params.pos) {
              todo = todos.find(
                (candidate) => candidate.title === params.title,
              );
            }

            if (todo) {
              router.push({
                pathname: "/edit",
                params: { todo: JSON.stringify(todo) },
              });
            } else {
              Alert.alert("Not found", "No matching todo was found.");
            }
          } catch {
            Alert.alert("Error", "Failed to load todos");
          }
          break;
        }

        case "search":
          router.push({
            pathname: "/(tabs)/search",
            params: params.q === undefined ? {} : { q: params.q },
          });
          break;

        case "agenda": {
          const agendaParams: Record<string, string> = {};
          if (params.date !== undefined) agendaParams.date = params.date;
          if (params.span !== undefined) agendaParams.span = params.span;
          router.push({ pathname: "/(tabs)", params: agendaParams });
          break;
        }

        case "refresh":
          invalidateServerData();
          break;

        default:
          // Unknown action - just open the app
          break;
      }
      return true;
    },
    [api, invalidateServerData, isAuthenticated, router],
  );

  useEffect(() => {
    // Handle URL that opened the app
    Linking.getInitialURL().then(async (url) => {
      if (!url || initialUrlHandled.current) return;
      initialUrlHandled.current = await handleUrl(url);
    });

    // Handle URLs while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      void handleUrl(event.url);
    });
    const dataChangedSubscription = DeviceEventEmitter.addListener(
      "movaDataChanged",
      invalidateServerData,
    );

    return () => {
      subscription.remove();
      dataChangedSubscription.remove();
    };
  }, [handleUrl, invalidateServerData]);
}
