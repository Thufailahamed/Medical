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
      // Phase 2.4: required by Face ID. Description shown in iOS permission
      // prompt and App Store review.
      infoPlist: {
        NSFaceIDUsageDescription:
          "Unlock HealthHub with Face ID so your health records stay private.",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#ffffff",
      },
      package: "com.healthcare.app",
      // arm64 only — avoids Windows CMake/ninja failures on armeabi-v7a
      abiFilters: ["arm64-v8a"],
      // Phase 2.4: fingerprint permission for the biometric unlock path.
      permissions: ["android.permission.USE_BIOMETRIC", "android.permission.USE_FINGERPRINT"],
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-notifications",
      [
        "expo-font",
        {
          fonts: [
            "./node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf",
            "./node_modules/@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf",
            "./node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf",
            "./node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf",
            "./node_modules/@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf",
          ],
        },
      ],
    ],
    extra: {
      // Pulled at build time from the shell environment.
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
      devMode: process.env.EXPO_PUBLIC_DEV_MODE === "true",
      // Phase 1.3: WhatsApp onboarding deep-link. Format: digits only
      // (no `+` or `wa.me/` prefix), e.g. "94771234567". When unset the
      // "Continue with WhatsApp" button is hidden from the login screen.
      waPhone: process.env.EXPO_PUBLIC_WA_PHONE || "",
    },
  },
};
