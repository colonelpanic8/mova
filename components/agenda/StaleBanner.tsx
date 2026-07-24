import { formatRelativeTime } from "@/utils/timeFormatting";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

/** Human-friendly age of the currently displayed data, for the stale banner. */
function formatFetchedAgo(dataUpdatedAt: number): string {
  if (!Number.isFinite(dataUpdatedAt) || dataUpdatedAt <= 0) {
    return "earlier";
  }
  return formatRelativeTime(new Date(dataUpdatedAt));
}

interface StaleBannerProps {
  /** When the displayed data was fetched (ms epoch; 0 if never). */
  dataUpdatedAt: number;
  refreshing: boolean;
  onRetry: () => void;
}

/**
 * Non-destructive banner shown when a refresh fails but cached data is still
 * on screen: reports the age of what's displayed and offers a retry.
 */
export function StaleBanner({
  dataUpdatedAt,
  refreshing,
  onRetry,
}: StaleBannerProps) {
  const theme = useTheme();

  return (
    <View
      testID="agendaStaleBanner"
      style={[
        styles.staleBanner,
        { backgroundColor: theme.colors.errorContainer },
      ]}
    >
      <Text
        testID="agendaStaleBannerText"
        variant="bodySmall"
        style={[
          styles.staleBannerText,
          { color: theme.colors.onErrorContainer },
        ]}
      >
        {`Couldn't refresh — showing data from ${formatFetchedAgo(dataUpdatedAt)}`}
      </Text>
      <IconButton
        icon="refresh"
        size={16}
        iconColor={theme.colors.onErrorContainer}
        onPress={onRetry}
        disabled={refreshing}
        testID="agendaStaleBannerRetry"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingVertical: 2,
  },
  staleBannerText: {
    flex: 1,
  },
});
