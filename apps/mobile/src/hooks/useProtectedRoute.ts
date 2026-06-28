import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { supabase } from "@/lib/supabase";
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

  useEffect(() => {
    if (DEV_MODE) {
      setUser(DEV_USER);
      return;
    }

    // Normal Supabase auth flow
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        api<{ user: any }>("/auth/me")
          .then((data) => setUser(data.user))
          .catch(() => {
            setUser({
              id: session.user!.id,
              supabaseId: session.user!.id,
              role: "patient",
              email: session.user!.email ?? null,
              phone: session.user!.phone ?? null,
              name: session.user!.user_metadata?.name || "",
              nic: null,
              photo: null,
              verified: false,
              createdAt: session.user!.created_at,
              updatedAt: session.user!.updated_at || session.user!.created_at,
            });
          });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          try {
            const data = await api<{ user: any }>("/auth/me");
            setUser(data.user);
          } catch {
            setUser({
              id: session.user.id,
              supabaseId: session.user.id,
              role: "patient",
              email: session.user.email ?? null,
              phone: session.user.phone ?? null,
              name: session.user.user_metadata?.name || "",
              nic: null,
              photo: null,
              verified: false,
              createdAt: session.user.created_at,
              updatedAt: session.user.updated_at || session.user.created_at,
            });
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(app)");
    }
  }, [isAuthenticated, isLoading, segments]);
}
