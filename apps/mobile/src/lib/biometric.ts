// Phase 2.4: biometric wrapper.
//
// Wraps `expo-local-authentication`. Normalises the three states the
// rest of the app cares about into a single discriminated union so the
// UI doesn't have to know about platform quirks:
//
//   - "available"        → hardware + enrolment both present
//   - "no_hardware"      → device has no biometric sensor
//   - "no_enrolment"     → hardware exists but user hasn't enrolled
//   - "locked_out"       → too many failed attempts, OS cooldown
//   - "unsupported"      → catch-all for anything else

import * as LocalAuthentication from "expo-local-authentication";

export type BiometricStatus =
  | "available"
  | "no_hardware"
  | "no_enrolment"
  | "locked_out"
  | "unsupported";

export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return "no_hardware";

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return "no_enrolment";

    // `getEnrolledLevelAsync` returns 0=none, 1=fingerprint-only,
    // 2=face (iOS X). Anything > 0 means we can offer a prompt.
    // Older SDKs fall back to the boolean above.
    if (typeof LocalAuthentication.getEnrolledLevelAsync === "function") {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level <= 0) return "no_enrolment";
    }
    return "available";
  } catch {
    return "unsupported";
  }
}

/**
 * Prompt the OS biometric sheet. Returns:
 *   "ok"            — user authenticated
 *   "canceled"      — user dismissed the sheet
 *   "locked_out"    — too many fails, OS cooldown
 *   "no_passcode"   — device has no passcode set (some platforms require it)
 *   "failed"        — anything else
 */
export type BiometricAuthResult =
  | "ok"
  | "canceled"
  | "locked_out"
  | "no_passcode"
  | "failed";

export async function promptBiometric(
  promptMessage: string,
  cancelLabel = "Cancel",
): Promise<BiometricAuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel: "Use PIN",
      disableDeviceFallback: false,
    });
    if (result.success) return "ok";
    if (result.error === "user_cancel" || result.error === "system_cancel") {
      return "canceled";
    }
    if (result.error === "lockout" || result.error === "lockout_permanent") {
      return "locked_out";
    }
    if (result.error === "passcode_not_set") return "no_passcode";
    return "failed";
  } catch {
    return "failed";
  }
}

/**
 * Human-readable name for the enrolled modality. "Face ID" vs
 * "Touch ID" vs "Fingerprint" — surfaces in prompts + settings.
 */
export async function biometricName(): Promise<string> {
  try {
    const supported =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (
      supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ) {
      return "Face ID";
    }
    if (
      supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ) {
      return "Touch ID";
    }
  } catch {
    // fall through
  }
  return "Biometric";
}
