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

/** Canonical role → route-group home. super_admin lands on the admin
 * portal; doctor/caretaker on theirs; everyone else on the patient app. */
export function homeForRole(role: string | null | undefined): string {
  return role === "super_admin" || role === "admin"
    ? "/(admin)"
    : role === "doctor"
    ? "/(doctor)"
    : role === "caretaker"
    ? "/(caretaker)"
    : "/(app)";
}

/** Route group a role is allowed to sit in. Used to bounce users who
 * landed in the wrong group (e.g. a doctor stuck on /(app) after a
 * buggy MFA-enroll finish) back to their canonical home instead of
 * showing an empty patient screen. */
function groupForRole(role: string | null | undefined): string {
  return role === "super_admin" || role === "admin"
    ? "(admin)"
    : role === "doctor"
    ? "(doctor)"
    : role === "caretaker"
    ? "(caretaker)"
    : "(app)";
}

export function useProtectedRoute(isReady: boolean = true) {
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
    if (!isReady || isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inLockGroup = segments[0] === "lock";

    if (!isAuthenticated && !inAuthGroup && !inLockGroup) {
      const t = setTimeout(() => {
        router.replace("/(auth)/login");
      }, 0);
      return () => clearTimeout(t);
    } else if (isAuthenticated && inAuthGroup) {
      const role = (useAuthStore.getState().user as any)?.role;
      const home = homeForRole(role);
      const t = setTimeout(() => {
        router.replace(home as any);
      }, 0);
      return () => clearTimeout(t);
    } else if (isAuthenticated && !inAuthGroup && !inLockGroup) {
      // Already signed in but sitting in the wrong role group (e.g. a
      // doctor on /(app) after a stale MFA-enroll finish). Bounce to
      // the canonical home so screens call role-correct endpoints
      // instead of rendering empty 403 states.
      const role = (useAuthStore.getState().user as any)?.role;
      const expected = groupForRole(role);
      const current = segments[0];
      if (
        current &&
        current !== expected &&
        ["(app)", "(doctor)", "(admin)", "(caretaker)"].includes(current)
      ) {
        const home = homeForRole(role);
        const t = setTimeout(() => {
          router.replace(home as any);
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [isReady, isAuthenticated, isLoading, segments]);
}
