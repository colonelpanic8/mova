import { CaptureBar } from "@/components/CaptureBar";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

// Hidden routes that shouldn't appear in tab bar
const HIDDEN_ROUTES = new Set<string>([]);

// Custom tab bar that includes CaptureBar above the tabs
function CustomTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation, insets } = props;
  const theme = useTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event: KeyboardEvent) => {
        setKeyboardVisible(true);
        Animated.timing(keyboardHeight, {
          toValue: event.endCoordinates.height,
          duration: Platform.OS === "ios" ? event.duration || 250 : 250,
          useNativeDriver: false,
        }).start();
      },
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (event: KeyboardEvent) => {
        setKeyboardVisible(false);
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === "ios" ? event.duration || 250 : 250,
          useNativeDriver: false,
        }).start();
      },
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardHeight]);

  // On Android, windowSoftInputMode="adjustResize" already handles window resizing.
  // Adding paddingBottom would double-count the keyboard space, making the content
  // area shrink by 2x the keyboard height (once from adjustResize, once from padding).
  // On iOS, we need animated padding to push the CaptureBar above the keyboard.

  return (
    <Animated.View
      style={{
        backgroundColor: theme.colors.surface,
        paddingBottom: Platform.OS === "ios" ? keyboardHeight : 0,
      }}
    >
      <CaptureBar />
      {!keyboardVisible && (
        <View
          style={{
            flexDirection: "row",
            paddingBottom: insets.bottom,
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
                testID={(options as any).tabBarButtonTestID}
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
      )}
    </Animated.View>
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
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
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
