/**
 * payments.lk checkout wrapper for Expo mobile.
 *
 * The backend creates the hosted checkout (payments.lk) and returns its
 * URL. We open it in the system browser (via `expo-web-browser`), then
 * poll the backend's `GET /payments/:appointmentId` when the app regains
 * focus. The payments.lk webhook has already updated the payment status
 * server-side by then; polling just confirms and the UI reactively
 * updates.
 */

import * as WebBrowser from "expo-web-browser";
import { AppState } from "react-native";

export interface PaymentsCheckoutInput {
  checkoutUrl: string;
  /** Poll this to detect when backend flipped to paid. */
  pollStatus: () => Promise<{ status: string }>;
  /** Max time to wait for paid status, in ms. Default 5min. */
  timeoutMs?: number;
}

export interface PaymentsCheckoutResult {
  status: "paid" | "failed" | "cancelled" | "timeout";
}

/** Open the hosted checkout page and wait for the result. */
export async function runPaymentsCheckout(
  input: PaymentsCheckoutInput
): Promise<PaymentsCheckoutResult> {
  const timeoutMs = input.timeoutMs ?? 5 * 60 * 1000;

  // Complete any pending session from a previous closed window.
  WebBrowser.maybeCompleteAuthSession();

  const openedAt = Date.now();

  const result = await new Promise<PaymentsCheckoutResult>((resolve) => {
    let resolved = false;

    const finish = (status: PaymentsCheckoutResult["status"]) => {
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

    void WebBrowser.openBrowserAsync(input.checkoutUrl).catch((err) => {
      console.error("[payments] openBrowserAsync failed:", err);
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
