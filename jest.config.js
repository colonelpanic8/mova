/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // Unit tests - pure Node.js environment
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
    // Integration tests - Node.js environment with container
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
      // Integration tests need longer timeout for container startup
      globals: {
        "ts-jest": {
          // Integration test timeout handled via jest.setTimeout in test file
        },
      },
    },
    // Component tests - React Native environment
    {
      displayName: "components",
      preset: "jest-expo",
      testMatch: ["<rootDir>/tests/components/**/*.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
      transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-paper)",
      ],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
  ],
};
