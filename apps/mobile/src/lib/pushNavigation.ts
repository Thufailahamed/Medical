import type { Router } from "expo-router";

type PushData = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function navigateFromPushData(
  router: Router,
  data: PushData | null | undefined,
  role?: string | null,
) {
  if (!data) return;

  const deepLink = asString(data.deepLink);
  if (deepLink) {
    if (deepLink.includes("/portal/queue") || deepLink.includes("/doctor/queue")) {
      router.push("/(doctor)/queue" as any);
      return;
    }
    if (deepLink.includes("appointment-detail") && asString(data.appointmentId)) {
      router.push({
        pathname: role === "doctor" ? "/(doctor)/schedule" : "/(app)/appointment-detail",
        params: role === "doctor" ? undefined : { id: asString(data.appointmentId)! },
      } as any);
      return;
    }
  }

  const appointmentId = asString(data.appointmentId);
  if (appointmentId) {
    if (role === "doctor") {
      router.push("/(doctor)/schedule" as any);
    } else {
      router.push({ pathname: "/(app)/appointment-detail", params: { id: appointmentId } } as any);
    }
    return;
  }

  const prescriptionId = asString(data.prescriptionId);
  if (prescriptionId) {
    if (role === "doctor") {
      router.push({
        pathname: "/(doctor)/prescription-detail",
        params: { id: prescriptionId },
      } as any);
    } else {
      router.push({ pathname: "/(app)/record-detail", params: { id: prescriptionId } } as any);
    }
    return;
  }

  const conversationId = asString(data.conversationId);
  if (conversationId) {
    if (role === "doctor") {
      router.push(`/(doctor)/inbox/${conversationId}` as any);
    }
    return;
  }

  const recordId = asString(data.recordId);
  if (recordId) {
    router.push({ pathname: "/(app)/record-detail", params: { id: recordId } } as any);
    return;
  }

  const patientId = asString(data.patientId);
  if (patientId && role === "doctor") {
    router.push({ pathname: "/(doctor)/patient-detail", params: { id: patientId } } as any);
    return;
  }

  const orderId = asString(data.orderId);
  if (orderId && role === "doctor") {
    router.push("/(doctor)/lab-orders" as any);
    return;
  }

  const walkInId = asString(data.walkInId);
  if (walkInId && role === "doctor") {
    router.push("/(doctor)/queue" as any);
    return;
  }

  if (role === "doctor") {
    router.push("/(doctor)/notifications" as any);
  } else {
    router.push("/(app)/notifications" as any);
  }
}
