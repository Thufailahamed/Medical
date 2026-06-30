import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import * as SplashScreen from "expo-splash-screen";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { registerForPushNotifications, onPushResponse } from "@/lib/push";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui";
import { applyOutfitFontDefaults } from "@/lib/fonts";

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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useProtectedRoute();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
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
    return unsubFinish;
  }, []);

  const ready = hasLocaleHydrated && fontsLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      applyOutfitFontDefaults();
    }
  }, [fontsLoaded]);

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