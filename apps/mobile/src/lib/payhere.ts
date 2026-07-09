/**
 * PayHere checkout wrapper for Expo mobile.
 *
 * Opens the hosted PayHere checkout page in the system browser (via
 * `expo-web-browser`), then polls our backend's
 * `GET /payments/:appointmentId` when the app regains focus. The PayHere
 * notify callback has already updated the payment status server-side by
 * then; polling just confirms and UI reactively updates.
 *
 * Why GET (not POST form): PayHere accepts both. GET on a system browser
 * means we don't need to ship a WebView — smaller APK, faster startup,
 * no extra native module.
 *
 * Sandbox vs live is controlled server-side via `sandbox` flag in the
 * initiate response.
 */

import * as WebBrowser from "expo-web-browser";
import { AppState } from "react-native";

export interface PayHereCheckoutInput {
  appointmentId: string;
  fields: Record<string, string>;
  checkoutUrl: string;
  /** Poll this to detect when backend flipped to paid. */
  pollStatus: () => Promise<{ status: string }>;
  /** Max time to wait for paid status, in ms. Default 5min. */
  timeoutMs?: number;
}

export interface PayHereCheckoutResult {
  status: "paid" | "failed" | "cancelled" | "timeout";
}

/** Build the PayHere checkout URL with all fields as query params. */
export function buildCheckoutUrl(
  base: string,
  fields: Record<string, string>
): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(fields)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

/** Open the PayHere checkout page and wait for the result. */
export async function runPayHereCheckout(
  input: PayHereCheckoutInput
): Promise<PayHereCheckoutResult> {
  const url = buildCheckoutUrl(input.checkoutUrl, input.fields);
  const timeoutMs = input.timeoutMs ?? 5 * 60 * 1000;

  // Complete any pending session from a previous closed window.
  WebBrowser.maybeCompleteAuthSession();

  // Open the system browser. The promise resolves when the user returns.
  // We don't wait on it directly — instead we hook AppState changes.
  const openedAt = Date.now();

  const result = await new Promise<PayHereCheckoutResult>((resolve) => {
    let resolved = false;

    const finish = (status: PayHereCheckoutResult["status"]) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ status });
    };

    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "active") return;
      // App regained focus — user returned from browser.
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, timeoutMs - elapsed);
      const pollResult = await pollUntilSettled(
        input.pollStatus,
        remaining
      );
      if (pollResult === "paid") return finish("paid");
      if (pollResult === "timeout") return finish("timeout");
      // If still pending after window closed, treat as cancelled.
      return finish("cancelled");
    });

    const cleanup = () => {
      sub.remove();
    };

    void WebBrowser.openBrowserAsync(url).catch((err) => {
      console.error("[payhere] openBrowserAsync failed:", err);
      finish("failed");
    });
  });

  return result;
}

/** Poll `pollStatus()` every 2s until status resolves to paid/failed or timeout. */
async function pollUntilSettled(
  pollStatus: () => Promise<{ status: string }>,
  maxMs: number
): Promise<"paid" | "failed" | "timeout"> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const r = await pollStatus();
      if (r.status === "paid") return "paid";
      if (r.status === "failed" || r.status === "refunded") return "failed";
    } catch {
      // network blip — keep polling
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  return "timeout";
}