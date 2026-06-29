import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "@/lib/api";

let registered = false;
let receivedSub: Notifications.Subscription | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Idempotent: ask permission, fetch Expo push token, register with backend.
 * Safe to call multiple times. No-op if already registered this session.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (registered) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== "granted") return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data;
    if (!token) return;

    await api("/push/push-tokens", {
      method: "POST",
      body: {
        token,
        platform:
          Platform.OS === "ios"
            ? "ios"
            : Platform.OS === "android"
              ? "android"
              : "web",
      },
    });
    registered = true;
  } catch (err) {
    console.warn("Push registration failed:", err);
  }
}

export function unregisterPush(token: string): Promise<void> {
  return api("/push/push-tokens", {
    method: "DELETE",
    body: { token },
  }).catch(() => undefined);
}

/**
 * Listen for received push notifications (foreground).
 * Returns a cleanup function.
 */
export function onPushReceived(
  handler: (n: Notifications.Notification) => void
): () => void {
  if (receivedSub) {
    receivedSub.remove();
    receivedSub = null;
  }
  receivedSub = Notifications.addNotificationReceivedListener(handler);
  return () => {
    receivedSub?.remove();
    receivedSub = null;
  };
}

/**
 * Listen for taps on notifications.
 * Returns a cleanup function.
 */
export function onPushResponse(
  handler: (resp: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}