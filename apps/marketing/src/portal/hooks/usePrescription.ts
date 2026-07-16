"use client";

/**
 * Prescription hooks — used by the composer, the detail page, and the
 * per-row actions on the list pages. Centralised here so the three
 * surfaces can never drift from the API.
 *
 * PDF download uses the `pdfDownload` helper that fetches via the
 * Zustand auth store (NOT localStorage — the existing detail page
 * reads the token from localStorage which is wrong; new code goes
 * through the store).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, qk, API_URL } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";

// ─── Types ──────────────────────────────────────────────

export interface PrescriptionMedicine {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  timing: string | null;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
  masterMedicineId: string | null;
}

export interface PrescriptionDetail {
  id: string;
  patientId: string;
  hospitalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  status: string;
  signedAt: string | null;
  signedPayloadHash: string | null;
  // Migration 0059: single-use redemption token. The doctor's
  // detail-page Dispense action uses this on `x-dispense-token`.
  // NULL on legacy signed Rx → button is disabled.
  dispenseToken: string | null;
  dispenseTokenConsumedAt: string | null;
  dispensedAt: string | null;
  cancelledAt: string | null;
  doctorName: string;
  doctorSpecialization: string;
  doctorSlmcNo: string | null;
  patient: { name: string; nic: string | null } | null;
  medicines: PrescriptionMedicine[];
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  createdAt: string;
}

export interface RxTemplateMedicine {
  name?: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  masterMedicineId?: string | null;
}

export interface RxTemplate {
  id: string;
  name: string;
  diagnosis: string | null;
  notes: string | null;
  specialty: string | null;
  useCount: number;
  medicines: RxTemplateMedicine[];
}

// ─── Read hooks ─────────────────────────────────────────

/** Fetch a single prescription by id. */
export function usePrescription(id: string | null | undefined) {
  return useQuery({
    queryKey: ["prescription", id],
    queryFn: () =>
      api<{ prescription: PrescriptionDetail }>(`/doctor/prescriptions/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Fetch the audit trail for a prescription. */
export function usePrescriptionAudit(id: string | null | undefined) {
  return useQuery({
    queryKey: ["prescription", id, "audit"],
    queryFn: () =>
      api<{ auditLogs: AuditLog[] }>(
        `/audit?resource=prescription&resourceId=${id}`
      ),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Fetch the doctor's saved Rx templates. */
export function useDoctorRxTemplates() {
  return useQuery({
    queryKey: qk.rxTemplates,
    queryFn: () => api<{ templates: RxTemplate[] }>("/doctor-rx-templates"),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────

/** Sign a draft prescription. Atomic; the server flips status
 *  draft → signed, writes a signature row, and mints a single-use
 *  `dispenseToken` (migration 0059). The token comes back in the
 *  response — components that want to dispense from the same row
 *  (e.g. doctor's own /:id/dispense legacy flow) should pass it into
 *  `useDispensePrescription({ id, dispenseToken })`. */
export function useSignPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; headers?: Record<string, string> }) => {
      const { id, headers } = vars;
      return api<{
        prescriptionId: string;
        signedAt: string;
        payloadHash: string;
        signatureId?: string;
        signingKeyId?: string;
        // Migration 0059: 32-byte base64url single-use redemption
        // token. Embedded in the signed PDF's QR as `?t=...`. Always
        // non-null on success for new Rx; legacy Rx signed before
        // migration 0059 will land here with `dispenseToken: null`
        // once the doctor's portal re-fetches the row.
        dispenseToken: string | null;
      }>(
        `/doctor/prescriptions/${id}/sign`,
        { method: "POST", json: {}, headers }
      );
    },
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Cancel a draft or signed prescription. Server enforces source
 *  states; 409 if it's already cancelled or dispensed. */
export function useCancelPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      api<{ ok: true; prescriptionId: string; status: string }>(
        `/doctor/prescriptions/${id}/cancel`,
        { method: "POST", json: { reason } }
      ),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Dispense a signed prescription (doctor-side legacy path).
 *  Returns 409 if it's not in `signed` state. The portal must supply
 *  the single-use `dispenseToken` (from the row returned by GET
 *  /doctor/prescriptions/:id, or from the /sign response on the same
 *  session) — the server now requires `x-dispense-token` to enforce
 *  the one-time-use guarantee regardless of which side dispenses.
 *  Missing/empty token → 400 `dispense_token_required` (or
 *  `dispense_token_missing` for legacy Rx). */
export function useDispensePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dispenseToken,
    }: {
      id: string;
      dispenseToken: string | null | undefined;
    }) => {
      if (!dispenseToken) {
        // Surface as a controlled error — the API would reject the
        // request with 400 too, but the message here is friendlier.
        throw new Error("Dispense token is required (re-issue if missing).");
      }
      return api<{
        ok: true;
        prescriptionId: string;
        status: string;
        dispensedAt: string;
      }>(`/doctor/prescriptions/${id}/dispense`, {
        method: "POST",
        json: {},
        headers: { "x-dispense-token": dispenseToken },
      });
    },
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Pharmacy-side dispense. POSTs to /pharmacy/prescriptions/:id/dispense.
 *  Used by the pharmacy portal flow (`/portal/pharmacy`).
 *  Migration 0059: requires the single-use `dispenseToken` on the
 *  `x-dispense-token` header. The token comes from the row returned
 *  by GET /pharmacy/prescriptions (list or detail). Missing token →
 *  400; wrong token → 404; second call with the same token → 409
 *  `token_consumed`. */
export function usePharmacyDispense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dispenseToken,
    }: {
      id: string;
      dispenseToken: string | null | undefined;
    }) => {
      if (!dispenseToken) {
        throw new Error(
          "Dispense token missing — the prescription was signed before redemption tokens were required. Re-issue from the doctor portal.",
        );
      }
      return api<{
        ok: true;
        prescriptionId: string;
        status: string;
        dispensedAt: string;
        dispensedBy: {
          pharmacyName: string | null;
          userId: string | null;
        };
      }>(`/pharmacy/prescriptions/${id}/dispense`, {
        method: "POST",
        json: {},
        headers: { "x-dispense-token": dispenseToken },
      });
    },
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["pharmacy", "prescriptions"] });
    },
  });
}

/** Pharmacy-side reject (signed → cancelled with a reason). Mirrors
 *  `useCancelPrescription` but POSTs to the pharmacy endpoint. */
export function usePharmacyReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      api<{
        ok: true;
        prescriptionId: string;
        status: string;
        cancelledAt: string;
        cancellationReason: string | null;
      }>(`/pharmacy/prescriptions/${id}/reject`, {
        method: "POST",
        json: { reason },
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["pharmacy", "prescriptions"] });
    },
  });
}

/** Update a draft prescription. Server enforces status === draft.
 *  `headers` carries `X-Confirm-Warning: true` when the doctor has
 *  acknowledged a blocking safety warning. */
export function useUpdatePrescriptionDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
      headers,
    }: {
      id: string;
      body: any;
      headers?: Record<string, string>;
    }) =>
      api<{ ok: true; prescriptionId: string }>(
        `/doctor/prescriptions/${id}`,
        { method: "PATCH", json: body, headers }
      ),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Create a new draft prescription. `headers` carries the safety
 *  override ack when needed. */
export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      headers,
    }: {
      body: any;
      headers?: Record<string, string>;
    }) =>
      api<{ prescription: { id: string } }>("/doctor/prescriptions", {
        method: "POST",
        json: body,
        headers,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Save a prescription as a reusable template. */
export function useCreateRxTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      diagnosis?: string;
      notes?: string;
      medicines: RxTemplateMedicine[];
    }) =>
      api<{ template: RxTemplate }>("/doctor-rx-templates", {
        method: "POST",
        json: body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rxTemplates });
    },
  });
}

/** Increment a template's useCount — called from the composer when the
 *  doctor taps a template chip. Fire-and-forget from the UI side. */
export function useRecordRxTemplateUse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api<{ ok: true }>(`/doctor-rx-templates/${id}/use`, {
        method: "POST",
        json: {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rxTemplates });
    },
  });
}

/** Rotate the doctor's signing key. */
export function useRotateSigningKey() {
  return useMutation({
    mutationFn: () =>
      api<{
        keyId: string;
        createdAt: string;
        rotatedFrom: string | null;
        note: string;
      }>("/doctor/regenerate-signing-key", { method: "POST", json: {} }),
  });
}

// ─── PDF download (extracted from detail page) ──────────

/**
 * Trigger a browser download for the prescription PDF. Returns the
 * caller-visible state so the action button can show a loading spinner
 * and an error toast on failure.
 *
 * Uses the Zustand auth store for the bearer token (not localStorage —
 * the existing detail page used to read `portal_token` from
 * localStorage, which was wrong).
 */
export function downloadPrescriptionPdf(opts: {
  id: string;
  apiUrl?: string;
  /** Override the filename (defaults to `prescription-<id>.pdf`). */
  filename?: string;
}) {
  const token = useAuthStore.getState().token;
  const url = `${opts.apiUrl ?? API_URL}/doctor/prescriptions/${opts.id}/pdf`;

  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (res) => {
    if (!res.ok) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // Non-JSON error body — fall through with a generic message.
      }
      throw new Error(body?.error ?? `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = opts.filename ?? `prescription-${opts.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(objUrl);
    document.body.removeChild(a);
  });
}
