export default {
  expo: {
    name: "Healthcare",
    slug: "healthcare-mobile",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "healthcare",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.healthcare.app",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#ffffff",
      },
      package: "com.healthcare.app",
      // arm64 only — avoids Windows CMake/ninja failures on armeabi-v7a
      abiFilters: ["arm64-v8a"],
    },
    plugins: ["expo-router", "expo-secure-store", "expo-notifications"],
    extra: {
      // Pulled at build time from the shell environment.
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
      devMode: process.env.EXPO_PUBLIC_DEV_MODE === "true",
    },
  },
};
