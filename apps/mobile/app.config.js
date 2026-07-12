export default {
  expo: {
    name: "HealthHub",
    slug: "healthcare-mobile",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "healthcare",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    // ─── Asset placeholders ────────────────────────────────
    // Replace the teal blocks under assets/ with production artwork
    // before the first store submission. Sizes match EAS defaults
    // (icon 1024, splash 1284×2778, adaptive 1024, favicon 48,
    // notification 96).
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0EA5A4",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0EA5A4",
      },
      package: "com.healthcare.app",
      // arm64 only — avoids Windows CMake/ninja failures on armeabi-v7a
      abiFilters: ["arm64-v8a"],
      permissions: [
        // Biometric unlock for app-lock
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        // Camera for document/prescription capture + profile photo
        "android.permission.CAMERA",
        // Microphone for voice notes
        "android.permission.RECORD_AUDIO",
        // Photo access — Android 13+ scoped media permission
        "android.permission.READ_MEDIA_IMAGES",
        // Location for emergency SOS
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        // Push notifications — Android 13+ requires runtime grant
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.healthcare.app",
      // Required Info.plist strings. App Store reviewers check each
      // one against its actual use site; keep descriptions accurate
      // to the camera/photo/mic/location flows in the app.
      infoPlist: {
        NSFaceIDUsageDescription:
          "Unlock HealthHub with Face ID so your health records stay private.",
        NSCameraUsageDescription:
          "Capture documents, prescriptions, and profile photos for your medical record.",
        NSPhotoLibraryUsageDescription:
          "Attach existing images to your medical records.",
        NSPhotoLibraryAddUsageDescription:
          "Save prescriptions and lab reports to your photo library.",
        NSMicrophoneUsageDescription:
          "Record voice notes for your doctor.",
        NSLocationWhenInUseUsageDescription:
          "Share your location during an emergency SOS.",
      },
    },
    notification: {
      icon: "./assets/notification-icon.png",
      color: "#0EA5A4",
    },
    favicon: "./assets/favicon.png",

    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-notifications",
      "expo-location",
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
      // Support WhatsApp number — wa.me deep-link from the Support screen
      // and appointment-detail help CTA. Same digits-only format.
      waSupportPhone: process.env.EXPO_PUBLIC_WA_SUPPORT_PHONE || "",
      // App Store / Play Store privacy policy. Set via env in CI; the
      // fallback points at the marketing-site page that ships the
      // DSAR/privacy disclosure for the platform.
      privacyPolicyURL:
        process.env.PRIVACY_POLICY_URL ||
        "https://healthhub.example.com/privacy",
    },
  },
};