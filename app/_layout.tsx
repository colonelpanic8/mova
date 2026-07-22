import { ApiProvider } from "@/context/ApiContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ColorPaletteProvider } from "@/context/ColorPaletteContext";
import { FilterProvider } from "@/context/FilterContext";
import { OutboxProvider } from "@/context/OutboxContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { SnackbarProvider } from "@/context/SnackbarContext";
import { TemplatesProvider } from "@/context/TemplatesContext";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import {
  createAppPersister,
  createAppQueryClient,
  QUERY_CACHE_BUSTER,
  QUERY_PERSIST_MAX_AGE_MS,
  shouldPersistQueryKey,
} from "@/services/queryClient";
import { getTheme } from "@/theme";
import {
  PersistQueryClientProvider,
  type PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

// Register background sync task (imported here to avoid loading expo modules in widget headless context)
import "@/services/backgroundSync";

SplashScreen.preventAutoHideAsync();

// Module-level singletons so fast-refresh / re-renders of RootLayout never
// recreate the cache. The persister restores agenda/metadata/habit queries
// from AsyncStorage on launch for offline-first startup.
const queryClient = createAppQueryClient();
const queryPersister = createAppPersister();
const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  buster: QUERY_CACHE_BUSTER,
  maxAge: QUERY_PERSIST_MAX_AGE_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" && shouldPersistQueryKey(query.queryKey),
  },
};

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle deep links (mova://create, mova://complete, etc.)
  useDeepLinks();

  // Keep notifications synced for authenticated users even when navigating
  // outside the tabs stack (e.g. /edit).
  useNotificationSync();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const inAuthenticatedRoute = inAuthGroup || segments[0] === "edit";

    if (isAuthenticated && !inAuthenticatedRoute && segments[0] !== undefined) {
      router.replace("/(tabs)");
    } else if (!isAuthenticated && inAuthenticatedRoute) {
      router.replace("/login");
    } else if (!isAuthenticated && !segments[0]) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Treat any unexpected/unknown value as "system default" (null).
  // Some platforms/versions may report "unspecified", but RN's typings don't include it.
  const normalizedScheme =
    colorScheme === "dark" || colorScheme === "light" ? colorScheme : null;
  const theme = getTheme(normalizedScheme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ColorPaletteProvider>
          <PaperProvider theme={theme}>
            <SettingsProvider>
              <PersistQueryClientProvider
                client={queryClient}
                persistOptions={persistOptions}
              >
                <AuthProvider>
                  <ApiProvider>
                    <OutboxProvider>
                      <TemplatesProvider>
                        <FilterProvider>
                          <SnackbarProvider>
                            <RootLayoutNav />
                          </SnackbarProvider>
                        </FilterProvider>
                      </TemplatesProvider>
                    </OutboxProvider>
                  </ApiProvider>
                </AuthProvider>
              </PersistQueryClientProvider>
            </SettingsProvider>
          </PaperProvider>
        </ColorPaletteProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
