import { parseLinks } from "@/utils/links";
import React, { useMemo } from "react";
import { Linking, Text as NativeText } from "react-native";
import { Text, useTheme } from "react-native-paper";

type LinkifiedTextProps = React.ComponentProps<typeof Text> & {
  children: string;
};

export function openLink(url: string) {
  Linking.openURL(url).catch((error) => {
    console.warn("Failed to open link", url, error);
  });
}

export function LinkifiedText({ children, ...textProps }: LinkifiedTextProps) {
  const theme = useTheme();
  const segments = useMemo(() => parseLinks(children), [children]);

  return (
    <Text {...textProps}>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <NativeText
            key={index}
            style={{
              color: theme.colors.primary,
            }}
            onPress={() => openLink(segment.url)}
            accessibilityRole="link"
          >
            {segment.text}
          </NativeText>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );
}
