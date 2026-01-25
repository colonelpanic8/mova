import { ApiProvider } from "@/context/ApiContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ColorPaletteProvider } from "@/context/ColorPaletteContext";
import { FilterProvider } from "@/context/FilterContext";
import { HabitConfigProvider } from "@/context/HabitConfigContext";
import { MutationProvider } from "@/context/MutationContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { TemplatesProvider } from "@/context/TemplatesContext";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { getTheme } from "@/theme";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

// Register background sync task (imported here to avoid loading expo modules in widget headless context)
import "@/services/backgroundSync";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle deep links (mova://create, mova://complete, etc.)
  useDeepLinks();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const inAuthenticatedRoute =
      inAuthGroup || segments[0] === "edit" || segments[0] === "body-editor";

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
      <Stack.Screen name="body-editor" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ColorPaletteProvider>
        <PaperProvider theme={theme}>
          <SettingsProvider>
            <MutationProvider>
              <AuthProvider>
                <ApiProvider>
                  <TemplatesProvider>
                    <HabitConfigProvider>
                      <FilterProvider>
                        <RootLayoutNav />
                      </FilterProvider>
                    </HabitConfigProvider>
                  </TemplatesProvider>
                </ApiProvider>
              </AuthProvider>
            </MutationProvider>
          </SettingsProvider>
        </PaperProvider>
      </ColorPaletteProvider>
    </GestureHandlerRootView>
  );
}
