// E2E test entry point - skips widget registration to allow Detox idle detection
// The widget module prevents the main thread from going idle, causing Detox timeouts

// Import the Expo Router entry point directly without widget registration
import "expo-router/entry";
