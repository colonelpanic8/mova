const { execSync } = require("child_process");
const packageJson = require("./package.json");

function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
    }).trim();
    const isDirty =
      execSync("git status --porcelain", { encoding: "utf8" }).trim().length >
      0;
    return isDirty ? `${hash}-dirty` : hash;
  } catch {
    return "unknown";
  }
}

export default {
  expo: {
    name: "mova",
    slug: "mova",
    version: packageJson.version,
    orientation: "portrait",
    icon: "./assets/images/mova.png",
    scheme: "mova",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.colonelpanic.mova",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/mova.png",
        backgroundColor: "#c9a227",
      },
      package: "com.colonelpanic.mova",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "mova",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      permissions: [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/mova.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/mova.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#c9a227",
        },
      ],
      "expo-notifications",
      "expo-background-fetch",
      [
        "react-native-android-widget",
        {
          widgets: [
            {
              name: "QuickCaptureWidget",
              label: "Mova Quick Capture",
              minWidth: "250dp",
              minHeight: "40dp",
              description: "Quickly capture todos from your home screen",
              previewImage: "./assets/images/widget-preview.png",
              resizeMode: "horizontal",
              widgetFeatures: "reconfigurable",
              targetCellWidth: 4,
              targetCellHeight: 1,
            },
          ],
        },
      ],
      "expo-font",
      "@react-native-community/datetimepicker",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      gitCommit: process.env.MOVA_GIT_COMMIT || getGitInfo(),
    },
  },
};
