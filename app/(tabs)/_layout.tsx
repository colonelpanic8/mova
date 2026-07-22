import { CaptureBar } from "@/components/CaptureBar";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import { useTheme } from "react-native-paper";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

// Hidden routes that shouldn't appear in tab bar
const HIDDEN_ROUTES = new Set<string>([]);
const TAB_BAR_CONTENT_HEIGHT = 40;

// Custom tab bar that includes CaptureBar above the tabs
function CustomTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation, insets } = props;
  const theme = useTheme();
  const { progress } = useReanimatedKeyboardAnimation();
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [TAB_BAR_CONTENT_HEIGHT + insets.bottom, 0],
    ),
    opacity: 1 - progress.value,
  }));

  return (
    <KeyboardStickyView
      style={{
        backgroundColor: theme.colors.surface,
      }}
    >
      <CaptureBar />
      <Reanimated.View
        pointerEvents="box-none"
        style={[{ overflow: "hidden" }, tabBarAnimatedStyle]}
      >
        <View
          style={{
            flexDirection: "row",
            paddingBottom: insets.bottom,
            height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
            backgroundColor: theme.colors.surface,
          }}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];

            // Skip hidden tabs
            if (HIDDEN_ROUTES.has(route.name)) {
              return null;
            }

            const isFocused = state.index === index;
            const color = isFocused
              ? theme.colors.primary
              : theme.colors.outline;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            // Get the icon from options
            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: 24,
            });

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={(() => {
                  const o = options as unknown as {
                    tabBarButtonTestID?: unknown;
                  };
                  return typeof o.tabBarButtonTestID === "string"
                    ? o.tabBarButtonTestID
                    : undefined;
                })()}
                onPress={onPress}
                onLongPress={onLongPress}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 8,
                }}
              >
                {icon}
              </Pressable>
            );
          })}
        </View>
      </Reanimated.View>
    </KeyboardStickyView>
  );
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        // Native headers disabled - using custom ScreenHeader component instead
        // to fix Android edge-to-edge keyboard pushing header issue
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Agenda",
          tabBarButtonTestID: "tabAgenda",
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
        name="week"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="views"
        options={{
          title: "Views",
          tabBarButtonTestID: "tabViews",
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
        name="habits"
        options={{
          title: "Habits",
          tabBarButtonTestID: "tabHabits",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chart-timeline-variant"
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
          tabBarButtonTestID: "tabSearch",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="magnify" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarButtonTestID: "tabCapture",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarButtonTestID: "tabSettings",
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
  );
}
