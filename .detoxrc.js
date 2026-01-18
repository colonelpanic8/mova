/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
      // Use E2E entry file (skips widget registration for Detox compatibility)
      build:
        "cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -DtestBuildType=debug -Pexpo.e2e=true",
    },
    "android.release": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk",
      // Use E2E entry file (skips widget registration for Detox compatibility)
      build:
        "cd android && ./gradlew :app:assembleRelease :app:assembleReleaseAndroidTest -DtestBuildType=release -Pexpo.e2e=true",
    },
  },
  devices: {
    emulator: {
      type: "android.emulator",
      device: {
        avdName: "mova_test",
      },
    },
    attached: {
      type: "android.attached",
      device: {
        adbName: ".*", // Matches any attached device
      },
    },
  },
  configurations: {
    "android.emu.debug": {
      device: "emulator",
      app: "android.debug",
    },
    "android.emu.release": {
      device: "emulator",
      app: "android.release",
    },
    "android.att.debug": {
      device: "attached",
      app: "android.debug",
    },
    "android.att.release": {
      device: "attached",
      app: "android.release",
    },
  },
};
