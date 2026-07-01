import { polyfillWebCrypto } from "expo-standard-web-crypto";
polyfillWebCrypto();

import { Buffer } from "buffer";
global.Buffer = Buffer;

// Polyfill Node.js process global for browserify libraries
(global as any).process = (global as any).process || {};
(global as any).process.browser = true;
(global as any).process.env = (global as any).process.env || {};

import { useEffect, useState } from "react";
import { LogBox } from "react-native";
LogBox.ignoreLogs([
  "Support for defaultProps will be removed",
  "Require cycle: src/components/ui/AppText.tsx",
]);

import { I18nextProvider } from "react-i18next";
import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useAppLockGate } from "@/hooks/useAppLockGate";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useAppLockStore } from "@/stores/appLock";
import { registerForPushNotifications, onPushResponse } from "@/lib/push";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui";

import i18n from "@/i18n";

// NOTE on the hydration race:
// `useLocaleStore.persist.hasHydrated()` is async (SecureStore read), so we
// cannot synchronously read the persisted locale at module load. Instead we
// gate first render on hydration completion — splash covers the window so
// users never see a flash of English when they previously picked Sinhala.

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — splash already shown or hidden
});

const queryClient = new QueryClient();

function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar
        style={scheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.bg}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="lock/index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lock/setup" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useProtectedRoute();
  useAppLockGate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular: require("@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf"),
    Outfit_500Medium: require("@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf"),
    Outfit_600SemiBold: require("@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf"),
    Outfit_700Bold: require("@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf"),
    Outfit_800ExtraBold: require("@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf"),
  });

  // Track persisted-locale hydration. Initial value is the current sync
  // status; for new users this is `false` (hydration is async even with no
  // stored data) and flips to `true` once persist completes its first cycle.
  const [hasLocaleHydrated, setHasLocaleHydrated] = useState(
    useLocaleStore.persist.hasHydrated()
  );

  useEffect(() => {
    const unsubFinish = useLocaleStore.persist.onFinishHydration((state) => {
      i18n.changeLanguage(state.locale);
      setHasLocaleHydrated(true);
    });
    // If hydration already finished before this effect mounted (rare — only
    // on the very first synchronous path), pick up the current state now.
    if (useLocaleStore.persist.hasHydrated()) {
      i18n.changeLanguage(useLocaleStore.getState().locale);
      setHasLocaleHydrated(true);
    }
    const hydrationTimeout = setTimeout(() => {
      setHasLocaleHydrated(true);
    }, 2500);
    return () => {
      clearTimeout(hydrationTimeout);
      unsubFinish();
    };
  }, []);

  // Never block forever on fonts — release builds can fail asset resolution.
  const fontsReady = fontsLoaded || !!fontError;
  const ready = hasLocaleHydrated && fontsReady;



  useEffect(() => {
    if (fontError) {
      console.error("[fonts] Failed to load Outfit:", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Register for push notifications once authenticated.
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications();
    }
  }, [isAuthenticated]);

  // Tapping a push notification deep-links via router.
  useEffect(() => {
    const cleanup = onPushResponse((resp) => {
      const data: any = (resp.notification?.request?.content as any)?.data;
      if (data?.appointmentId) {
        router.push({
          pathname: "/(app)/appointment-detail",
          params: { id: data.appointmentId },
        });
      }
    });
    return cleanup;
  }, []);

  // Keep i18next in sync with persisted locale changes (from LocaleSwitcher).
  useEffect(() => {
    return useLocaleStore.subscribe((state) => {
      i18n.changeLanguage(state.locale);
    });
  }, []);

  // Render app shell while fonts load AND persisted locale hydrates; splash
  // covers the gap. Blocking on hydration prevents the EN→SI flash on cold
  // start for returning non-English users.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <ToastProvider>
              <ThemedStack />
            </ToastProvider>
          </ThemeProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}