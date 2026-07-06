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
 *  draft → signed and writes a signature row. */
export function useSignPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; headers?: Record<string, string> }) => {
      const { id, headers } = vars;
      return api<{ prescriptionId: string; signedAt: string; payloadHash: string }>(
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

/** Dispense a signed prescription. Returns 409 if it's not in
 *  `signed` state. Currently exposed for completeness; the pharmacy
 *  flow lives in a follow-up. */
export function useDispensePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api<{ ok: true; prescriptionId: string; status: string }>(
        `/doctor/prescriptions/${id}/dispense`,
        { method: "POST", json: {} }
      ),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Update a draft prescription. Server enforces status === draft. */
export function useUpdatePrescriptionDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) =>
      api<{ ok: true; prescriptionId: string }>(
        `/doctor/prescriptions/${id}`,
        { method: "PATCH", json: body }
      ),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["prescription", id] });
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

/** Create a new draft prescription. */
export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) =>
      api<{ prescription: { id: string } }>("/doctor/prescriptions", {
        method: "POST",
        json: body,
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
