import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, adminApiWithStepUp } from "@/lib/admin-api";

// ─── Shared types (loose — mirror the API shapes) ───────────

export type AdminUserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: string;
  status: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  createdAt?: string | null;
  verified?: boolean;
  lastLoginAt?: string | null;
  licenseNumber?: string | null;
  city?: string | null;
  [k: string]: any;
};

export type AdminDashboard = {
  generatedAt: string;
  users: {
    byRoleAndStatus: { role: string; status: string | null; count: number }[];
    pendingApprovals: number;
  };
  doctors: { slmcVerified: number; slmcUnverified: number };
  today: {
    auditEvents: number;
    appointments: number;
    prescriptionsLast7d: number;
  };
  operations: {
    pendingPayouts: number;
    openInsuranceClaims: number;
    openDsarRequests: number;
    newDemoRequests: number;
  };
  marketing: {
    waitlistTotal: number;
    broadcastsSent: number;
    broadcastsLast7d: number;
  };
};

export type AdminApprovalItem = {
  user: AdminUserRow;
  doctorProfile: {
    id: string;
    specialization?: string | null;
    registrationNumber?: string | null;
    slmcRegistrationNo?: string | null;
    slmcVerifiedAt?: string | null;
  } | null;
  labProfile: any | null;
};

export type AdminDoctorRow = {
  doctorId: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  specialization: string | null;
  registrationNumber: string | null;
  slmcRegistrationNo: string | null;
  slmcVerifiedAt: string | null;
  rating: number | null;
  experience: number | null;
  createdAt: string | null;
};

export type AdminTenantRow = {
  id: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  shortCode?: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerStatus: string | null;
  rating: number | null;
  createdAt: string | null;
};

export type AuditRow = {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

// ─── Query keys ──────────────────────────────────────────────

export const adminQk = {
  all: ["admin"] as const,
  dashboard: () => ["admin", "dashboard"] as const,
  approvals: (status: string, role?: string) =>
    ["admin", "approvals", status, role ?? "all"] as const,
  users: (p: Record<string, unknown>) => ["admin", "users", p] as const,
  user: (id: string) => ["admin", "users", id] as const,
  userNotes: (id: string) => ["admin", "users", id, "notes"] as const,
  doctors: (slmc: string) => ["admin", "doctors", slmc] as const,
  tenants: (type: string) => ["admin", "tenants", type] as const,
  tenant: (type: string, id: string) => ["admin", "tenants", type, id] as const,
  waitlist: (status: string) => ["admin", "waitlist", status] as const,
  demoRequests: (status: string) => ["admin", "demo-requests", status] as const,
  audit: (p: Record<string, unknown>) => ["admin", "audit", p] as const,
  payouts: (status: string) => ["admin", "payouts", status] as const,
  claims: (status: string) => ["admin", "claims", status] as const,
  dsar: (status: string) => ["admin", "dsar", status] as const,
  admins: () => ["admin", "admins"] as const,
  medicines: (q: string) => ["admin", "medicines", q] as const,
  settings: () => ["admin", "settings"] as const,
  health: () => ["admin", "health"] as const,
  healthErrors: () => ["admin", "health", "errors"] as const,
  verifications: (status: string) => ["admin", "verifications", status] as const,
  insuranceProviders: () => ["admin", "insurance-providers"] as const,
  insurancePlans: (providerId?: string) =>
    ["admin", "insurance-plans", providerId ?? "all"] as const,
  insuranceEnrollments: () => ["admin", "insurance-enrollments"] as const,
  insuranceMktClaims: (status: string) =>
    ["admin", "insurance-mkt-claims", status] as const,
  diagPackages: () => ["admin", "diag-packages"] as const,
  diagPackage: (id: string) => ["admin", "diag-packages", id] as const,
  operatorUsers: (role: string) => ["admin", "operator-users", role] as const,
  operatorDispatches: (status: string) =>
    ["admin", "operator-dispatches", status] as const,
  operatorClaims: (status: string) =>
    ["admin", "operator-claims", status] as const,
  cron: (name: string) => ["admin", "cron", name] as const,
};

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Invalidate every admin query after a mutation. */
export function useInvalidateAdmin() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: adminQk.all });
}

// ─── Dashboard ───────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<AdminDashboard>("/admin/dashboard"),
  });
}

// ─── Approvals ───────────────────────────────────────────────

export function useAdminApprovals(status = "pending", role?: string) {
  return useQuery({
    queryKey: adminQk.approvals(status, role),
    queryFn: () =>
      adminApi<{ items: AdminApprovalItem[]; total: number }>(
        `/admin/approvals${qs({ status, role })}`
      ),
  });
}

export function useApproveUser() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/approve`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

export function useRejectUser() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/reject`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

// ─── Users ───────────────────────────────────────────────────

export function useAdminUsers(params: {
  role?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: adminQk.users(params),
    queryFn: () =>
      adminApi<{ items: AdminUserRow[]; total: number }>(
        `/admin/users${qs({ ...params, limit: params.limit ?? 100 })}`
      ),
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminQk.user(id),
    enabled: !!id,
    queryFn: () =>
      adminApi<{ user: AdminUserRow; profiles: Record<string, any> }>(
        `/admin/users/${id}`
      ),
  });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (body: { name?: string; phone?: string | null; role?: string }) =>
      adminApiWithStepUp(`/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useSuspendUser(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (reason: string) =>
      adminApiWithStepUp(`/admin/users/${id}/suspend`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

export function useUnsuspendUser(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: () =>
      adminApiWithStepUp(`/admin/users/${id}/unsuspend`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeleteUser(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: () =>
      adminApiWithStepUp(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ─── User notes ──────────────────────────────────────────────

export function useAdminUserNotes(userId: string) {
  return useQuery({
    queryKey: adminQk.userNotes(userId),
    enabled: !!userId,
    queryFn: () =>
      adminApi<{ items: any[] }>(`/admin/users/${userId}/notes`),
  });
}

export function useAddUserNote(userId: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (body: string) =>
      adminApi(`/admin/users/${userId}/notes`, { method: "POST", body: { body } }),
    onSuccess: invalidate,
  });
}

export function useDeleteUserNote() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (noteId: string) =>
      adminApi(`/admin/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ─── Doctors ─────────────────────────────────────────────────

export function useAdminDoctors(slmc: "all" | "verified" | "unverified" = "all") {
  return useQuery({
    queryKey: adminQk.doctors(slmc),
    queryFn: () =>
      adminApi<{ items: AdminDoctorRow[]; total: number }>(
        `/admin/doctors${qs({ slmc, limit: 200 })}`
      ),
  });
}

export function useVerifySlmc() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (doctorId: string) =>
      adminApiWithStepUp(`/admin/doctors/${doctorId}/verify-slmc`, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeSlmc() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (doctorId: string) =>
      adminApiWithStepUp(`/admin/doctors/${doctorId}/revoke-slmc`, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

// ─── Tenants ─────────────────────────────────────────────────

export function useAdminTenants(type: "hospital" | "clinic") {
  return useQuery({
    queryKey: adminQk.tenants(type),
    queryFn: () =>
      adminApi<{ items: AdminTenantRow[]; total: number }>(
        `/admin/tenants?type=${type}`
      ),
  });
}

export function useAdminTenant(type: string, id: string) {
  return useQuery({
    queryKey: adminQk.tenant(type, id),
    enabled: !!type && !!id,
    queryFn: () =>
      adminApi<{ type: string; tenant: any }>(`/admin/tenants/${type}/${id}`),
  });
}

// ─── Waitlist ────────────────────────────────────────────────

export function useAdminWaitlist(status: "all" | "pending" | "invited" = "all") {
  return useQuery({
    queryKey: adminQk.waitlist(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/waitlist${qs({ status })}`
      ),
  });
}

export function useInviteWaitlist() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (id: string) =>
      adminApi(`/admin/waitlist/${id}/invite`, { method: "POST", body: {} }),
    onSuccess: invalidate,
  });
}

export function useRemoveWaitlist() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (id: string) =>
      adminApiWithStepUp(`/admin/waitlist/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ─── Demo requests ───────────────────────────────────────────

export function useAdminDemoRequests(status = "all") {
  return useQuery({
    queryKey: adminQk.demoRequests(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/demo-requests${qs({ status })}`
      ),
  });
}

export function useRespondDemoRequest() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reply,
    }: {
      id: string;
      status: "contacted" | "closed" | "new";
      reply?: string;
    }) =>
      adminApiWithStepUp(`/admin/demo-requests/${id}/respond`, {
        method: "POST",
        body: { status, reply },
      }),
    onSuccess: invalidate,
  });
}

// ─── Audit ───────────────────────────────────────────────────

export function useAdminAudit(params: {
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: adminQk.audit(params),
    queryFn: () =>
      adminApi<{ items: AuditRow[]; total: number }>(
        `/admin/audit${qs({ ...params, limit: params.limit ?? 100 })}`
      ),
  });
}

// ─── Payouts ─────────────────────────────────────────────────

export function useAdminPayouts(status = "all") {
  return useQuery({
    queryKey: adminQk.payouts(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/payouts${qs({ status })}`
      ),
  });
}

export function useMarkPayoutPaid() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      adminApiWithStepUp(`/admin/payouts/${id}/mark-paid`, {
        method: "POST",
        body: { reference },
      }),
    onSuccess: invalidate,
  });
}

export function useMarkPayoutFailed() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApiWithStepUp(`/admin/payouts/${id}/mark-failed`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

// ─── Insurance claims ────────────────────────────────────────

export function useAdminClaims(status = "all") {
  return useQuery({
    queryKey: adminQk.claims(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/insurance-claims${qs({ status })}`
      ),
  });
}

export function useDecideClaim() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approve" | "reject";
      reason?: string;
    }) =>
      adminApiWithStepUp(`/admin/insurance-claims/${id}/${decision}`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

// ─── DSAR ────────────────────────────────────────────────────

export function useAdminDsar(status = "all") {
  return useQuery({
    queryKey: adminQk.dsar(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(`/admin/dsar${qs({ status })}`),
  });
}

export function useDsarAction() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      resultUrl,
    }: {
      id: string;
      action: "approve" | "complete" | "reject" | "requeue";
      reason?: string;
      resultUrl?: string;
    }) =>
      adminApiWithStepUp(`/admin/dsar/${id}/${action}`, {
        method: "POST",
        body: { reason, resultUrl },
      }),
    onSuccess: invalidate,
  });
}

// ─── Admins ──────────────────────────────────────────────────

export function useAdminAdmins() {
  return useQuery({
    queryKey: adminQk.admins(),
    queryFn: () => adminApi<{ items: any[]; total: number }>("/admin/admins"),
  });
}

export function useAdminAction() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      action,
      userId,
      reason,
    }: {
      action: "promote" | "demote" | "suspend" | "unsuspend";
      userId: string;
      reason?: string;
    }) =>
      adminApiWithStepUp(`/admin/admins/${action}`, {
        method: "POST",
        body: { userId, reason },
      }),
    onSuccess: invalidate,
  });
}

// ─── Broadcast ───────────────────────────────────────────────

export function useBroadcast() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (body: {
      title: string;
      body: string;
      role?: string;
      audience?: "all" | "active";
    }) =>
      adminApi<{ ok: boolean; sent: number }>(
        "/admin/notifications/broadcast",
        { method: "POST", body }
      ),
    onSuccess: invalidate,
  });
}

// ─── Medicines master ────────────────────────────────────────

export function useAdminMedicines(q: string) {
  return useQuery({
    queryKey: adminQk.medicines(q),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/medicines-master${qs({ q, limit: 100 })}`
      ),
  });
}

export function useSaveMedicine() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: any }) =>
      id
        ? adminApiWithStepUp(`/admin/medicines-master/${id}`, {
            method: "PATCH",
            body,
          })
        : adminApiWithStepUp(`/admin/medicines-master`, {
            method: "POST",
            body,
          }),
    onSuccess: invalidate,
  });
}

// ─── Settings ────────────────────────────────────────────────

export type AdminSetting = {
  key: string;
  value: unknown;
  rawValue: string;
  valueType: string;
  category: string;
  description: string | null;
  isSensitive: boolean;
  updatedAt: string | null;
};

export function useAdminSettings() {
  return useQuery({
    queryKey: adminQk.settings(),
    queryFn: () =>
      adminApi<{ items: AdminSetting[]; grouped: Record<string, AdminSetting[]> }>(
        "/admin/settings"
      ),
  });
}

export function useUpdateSetting() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      key,
      value,
      confirm,
    }: {
      key: string;
      value: unknown;
      confirm?: boolean;
    }) =>
      adminApi(`/admin/settings/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: { value, confirm },
      }),
    onSuccess: invalidate,
  });
}

// ─── Caretaker verifications ─────────────────────────────────

export function useAdminVerifications(status = "pending") {
  return useQuery({
    queryKey: adminQk.verifications(status),
    queryFn: () =>
      adminApi<{ verifications: any[] }>(
        `/admin/caretaker-verifications${qs({ status })}`
      ),
  });
}

export function useVerificationAction() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      reason,
    }: {
      kind: "approve" | "reject" | "revoke";
      id: string; // verification id, or userId for revoke
      reason?: string;
    }) =>
      adminApiWithStepUp(`/admin/caretaker-verifications/${id}/${kind}`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

// ─── System health ───────────────────────────────────────────

export function useAdminHealth() {
  return useQuery({
    queryKey: adminQk.health(),
    queryFn: () => adminApi<any>("/admin/health/overview"),
  });
}

export function useAdminHealthErrors() {
  return useQuery({
    queryKey: adminQk.healthErrors(),
    queryFn: () => adminApi<{ items: AuditRow[] }>("/admin/health/errors"),
  });
}

export function useAdminCronRuns(name: string) {
  return useQuery({
    queryKey: adminQk.cron(name),
    enabled: !!name,
    queryFn: () =>
      adminApi<{ name: string; items: AuditRow[] }>(
        `/admin/health/cron/${name}`
      ),
  });
}

// ─── Insurance marketplace ───────────────────────────────────
// super_admin CRUD for providers/plans; enrollments + marketplace
// claims are read-only for the admin.

export function useInsuranceProviders() {
  return useQuery({
    queryKey: adminQk.insuranceProviders(),
    queryFn: () => adminApi<{ providers: any[] }>("/admin/insurance-providers"),
  });
}

export function useSaveInsuranceProvider() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: any }) =>
      id
        ? adminApi(`/admin/insurance-providers/${id}`, {
            method: "PUT",
            body,
          })
        : adminApi("/admin/insurance-providers", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useInsurancePlans(providerId?: string) {
  return useQuery({
    queryKey: adminQk.insurancePlans(providerId),
    queryFn: () =>
      adminApi<{ plans: any[] }>(
        `/admin/insurance-plans${qs({ provider_id: providerId })}`
      ),
  });
}

export function useSaveInsurancePlan() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: any }) =>
      id
        ? adminApi(`/admin/insurance-plans/${id}`, { method: "PUT", body })
        : adminApi("/admin/insurance-plans", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useInsuranceEnrollments() {
  return useQuery({
    queryKey: adminQk.insuranceEnrollments(),
    queryFn: () =>
      adminApi<{ enrollments: any[] }>("/admin/insurance-enrollments"),
  });
}

export function useInsuranceMktClaims(status = "all") {
  return useQuery({
    queryKey: adminQk.insuranceMktClaims(status),
    queryFn: () =>
      adminApi<{ claims: any[]; total: number }>(
        `/admin/insurance-mkt-claims${qs({ status })}`
      ),
  });
}

// ─── Diagnostics packages ────────────────────────────────────

export function useDiagnosticsPackages() {
  return useQuery({
    queryKey: adminQk.diagPackages(),
    queryFn: () =>
      adminApi<{ packages: any[] }>("/admin/diagnostics/packages"),
  });
}

export function useDiagnosticsPackage(id: string) {
  return useQuery({
    queryKey: adminQk.diagPackage(id),
    enabled: !!id,
    queryFn: () =>
      adminApi<{ package: any; items: any[]; images: any[] }>(
        `/admin/diagnostics/packages/${id}`
      ),
  });
}

export function useSaveDiagnosticsPackage() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: any }) =>
      id
        ? adminApi(`/admin/diagnostics/packages/${id}`, {
            method: "PATCH",
            body,
          })
        : adminApi("/admin/diagnostics/packages", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useDeactivateDiagnosticsPackage() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (id: string) =>
      adminApiWithStepUp(`/admin/diagnostics/packages/${id}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
}

export function useSetPackageImage() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) =>
      adminApi(`/admin/diagnostics/packages/${id}/image`, {
        method: "PUT",
        body: { imageUrl },
      }),
    onSuccess: invalidate,
  });
}

// ─── Operators (insurance / ambulance accounts + dispatches) ─

export function useOperatorUsers(role: "ambulance" | "insurance") {
  return useQuery({
    queryKey: adminQk.operatorUsers(role),
    queryFn: () =>
      adminApi<{ items: AdminUserRow[]; total: number }>(
        `/admin/operator/users${qs({ role })}`
      ),
  });
}

export function useOperatorDispatches(status = "all") {
  return useQuery({
    queryKey: adminQk.operatorDispatches(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number }>(
        `/admin/operator/dispatches${qs({ status })}`
      ),
  });
}

export function useAcknowledgeDispatch() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (id: string) =>
      adminApiWithStepUp(`/admin/operator/dispatches/${id}/acknowledge`, {
        method: "POST",
        body: {},
      }),
    onSuccess: invalidate,
  });
}

export function useOperatorClaims(status = "all") {
  return useQuery({
    queryKey: adminQk.operatorClaims(status),
    queryFn: () =>
      adminApi<{ items: any[]; total: number; hint?: string }>(
        `/admin/operator/claims${qs({ status })}`
      ),
  });
}

export function useDecideOperatorClaim() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approve" | "reject";
      reason?: string;
    }) =>
      adminApiWithStepUp(`/admin/operator/claims/${id}/${decision}`, {
        method: "POST",
        body: decision === "reject" ? { reason } : {},
      }),
    onSuccess: invalidate,
  });
}

// ─── Impersonation ───────────────────────────────────────────
// The minted token carries aud:"admin" and is intended for the web
// console — mobile endpoints reject it. We still expose start/end
// so sessions are audited from mobile.

export function useImpersonateStart() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp<{
        token: string;
        expiresAt: string;
        targetUser: { id: string; name: string; email: string; role: string };
      }>("/admin/impersonate/start", { method: "POST", body: { userId } }),
    onSuccess: invalidate,
  });
}

export function useImpersonateEnd() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: () =>
      adminApiWithStepUp("/admin/impersonate/end", { method: "POST" }),
    onSuccess: invalidate,
  });
}

// ─── Bulk operations ─────────────────────────────────────────

export type BulkResult = {
  results: { userId: string; status: "ok" | "error"; code?: string; message?: string }[];
  successCount: number;
  failureCount: number;
};

export function useBulkAction() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({
      action,
      userIds,
      reason,
    }: {
      action: "approve" | "reject" | "suspend" | "unsuspend" | "delete";
      userIds: string[];
      reason?: string;
    }) =>
      adminApiWithStepUp<BulkResult>(`/admin/bulk/${action}`, {
        method: "POST",
        body:
          action === "delete"
            ? { userIds, confirm: true }
            : action === "reject" || action === "suspend"
              ? { userIds, reason }
              : { userIds },
      }),
    onSuccess: invalidate,
  });
}
