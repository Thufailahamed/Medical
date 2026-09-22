// @ts-nocheck
// Tenant isolation guard for medical documents.
// If the request carries an active hospital context, a record pinned to a
// different hospital is denied. Records with NULL hospitalId are legacy/
// patient-owned and remain accessible via relationship checks.

export function assertTenantAccess(record: any, c: any): { allowed: boolean; reason?: string } {
  const activeHospitalId = c.get("activeHospitalId") || null;
  if (!activeHospitalId) return { allowed: true };
  if (!record) return { allowed: false, reason: "Record not found" };
  if (record.hospitalId && record.hospitalId !== activeHospitalId) {
    return { allowed: false, reason: "tenant_mismatch" };
  }
  return { allowed: true };
}
