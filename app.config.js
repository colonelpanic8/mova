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
    icon: "./assets/images/mova-icon-final.png",
    scheme: "mova",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.colonelpanic.mova",
      backgroundColor: "#FDF6E3",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/mova-adaptive-foreground.png",
        backgroundColor: "#FDF6E3",
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
      favicon: "./assets/images/mova-icon-final.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-speech-recognition",
        {
          microphonePermission:
            "Allow Mova to use the microphone for voice capture.",
          speechRecognitionPermission:
            "Allow Mova to use speech recognition for voice capture.",
          androidSpeechServicePackages: [
            "com.google.android.googlequicksearchbox",
          ],
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/mova-icon-final.png",
          imageWidth: 280,
          resizeMode: "contain",
          backgroundColor: "#FDF6E3",
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
