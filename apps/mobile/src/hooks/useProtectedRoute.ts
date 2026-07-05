import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

const DEV_USER = {
  id: "dev-user-001",
  supabaseId: "dev-user-001",
  email: "dev@healthhub.local",
  phone: "+94771234567",
  name: "Dev User",
  role: "patient" as const,
  nic: "123456789V",
  photo: null,
  verified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function useProtectedRoute() {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Load JWT token on launch and fetch profile
  useEffect(() => {
    if (DEV_MODE) {
      setUser(DEV_USER);
      return;
    }

    SecureStore.getItemAsync("auth_token")
      .then((token) => {
        if (token) {
          api<{ user: any }>("/auth/me")
            .then((data) => {
              setUser(data.user);
            })
            .catch(() => {
              // Token invalid or expired, clear it
              SecureStore.deleteItemAsync("auth_token").finally(() => {
                setUser(null);
                setLoading(false);
              });
            });
        } else {
          setUser(null);
          setLoading(false);
        }
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  // Listen for logout / auth failure to clear secure storage
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !DEV_MODE) {
      SecureStore.deleteItemAsync("auth_token").catch(() => {});
    }
  }, [isAuthenticated, isLoading]);

  // Route guarding based on authentication status
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      const t = setTimeout(() => {
        router.replace("/(auth)/login");
      }, 0);
      return () => clearTimeout(t);
    } else if (isAuthenticated && inAuthGroup) {
      const home =
        (useAuthStore.getState().user as any)?.role === "doctor"
          ? "/(doctor)"
          : "/(app)";
      const t = setTimeout(() => {
        router.replace(home as any);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, isLoading, segments]);
}
