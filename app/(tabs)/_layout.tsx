import { CaptureBar } from "@/components/CaptureBar";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 49;

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Tab bar height includes safe area bottom inset
  const tabBarTotalHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.outline,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.onSurface,
          // Add padding at the bottom of screen content for the capture bar
          sceneStyle: {
            paddingBottom: 52, // CaptureBar height
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Agenda",
            tabBarTestID: "tabAgenda",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="calendar-today"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="views"
          options={{
            title: "Views",
            tabBarTestID: "tabViews",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="view-list"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarTestID: "tabSearch",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="magnify" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="capture"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarTestID: "tabSettings",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="cog-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
      <View
        style={{
          position: "absolute",
          bottom: tabBarTotalHeight,
          left: 0,
          right: 0,
        }}
      >
        <CaptureBar />
      </View>
    </View>
  );
}
