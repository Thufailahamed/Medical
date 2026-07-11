"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pill, PillRow } from "@/portal/components/ui/Pill";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Select } from "@/portal/components/ui/Form";
import { NotesPanel } from "@/portal/components/admin/NotesPanel";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  rejectionReason: string | null;
  suspendedReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  dateOfBirth: string | null;
  nic: string | null;
  verified: boolean | null;
  lastLoginAt: string | null;
};

type Payload = {
  user: User;
  profiles: {
    doctor: { id: string; specialization: string; slmcRegistrationNo: string | null; slmcVerifiedAt: string | null; rating: number | null } | null;
    hospital: { id: string; name: string; license: string | null } | null;
    clinic: { id: string; name: string; license: string | null } | null;
  };
};

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  pending: "warn",
  suspended: "danger",
  rejected: "danger",
};

const ROLES = [
  "patient",
  "doctor",
  "hospital_admin",
  "hospital_staff",
  "laboratory",
  "pharmacy",
  "insurance",
  "ambulance",
  "super_admin",
] as const;

const STATUSES = ["pending", "active", "suspended", "rejected"] as const;

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.user(id),
    queryFn: () => adminApi<Payload>(`/admin/users/${id}`),
  });

  const [editRole, setEditRole] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      adminApiWithStepUp(`/admin/users/${id}`, {
        method: "PATCH",
        json: {
          ...(editRole ? { role: editRole } : {}),
          ...(editStatus ? { status: editStatus } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
      setEditRole(null);
      setEditStatus(null);
    },
    onError: (e: any) => toast.error("Save failed", e.message),
  });

  if (isLoading || !data) {
    return <p className="text-text-soft text-sm">Loading user…</p>;
  }
  const u = data.user;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader title={u.name} subtitle={`${u.role} · joined ${new Date(u.createdAt).toLocaleDateString()}`} />

      <section className="bg-surface border border-border rounded-2xl p-5">
        <SectionHeader title="Account" />
        <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <Field label="Status"><PillRow><Pill tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status}</Pill></PillRow></Field>
          <Field label="Last login"><p>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</p></Field>
          <Field label="Email"><p>{u.email || "—"}</p></Field>
          <Field label="Phone"><p>{u.phone || "—"}</p></Field>
          <Field label="Date of birth"><p>{u.dateOfBirth || "—"}</p></Field>
          <Field label="Approved at"><p>{u.approvedAt ? new Date(u.approvedAt).toLocaleString() : "—"}</p></Field>
          <Field label="Suspension reason"><p className="text-red-700">{u.suspendedReason || "—"}</p></Field>
          <Field label="Rejection reason"><p className="text-red-700">{u.rejectionReason || "—"}</p></Field>
          <Field label="Verified NIC"><p>{u.verified ? "Yes" : "No"}</p></Field>
        </dl>

        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Edit</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-soft">Role</label>
              <Select
                value={editRole ?? u.role}
                onChange={(e) => setEditRole(e.target.value)}
                className="h-9 w-56"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-soft">Status</label>
              <Select
                value={editStatus ?? u.status}
                onChange={(e) => setEditStatus(e.target.value)}
                className="h-9 w-40"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <Button
              onClick={() => save.mutate()}
              loading={save.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!editRole && !editStatus}
            >
              Save changes
            </Button>
            <p className="text-xs text-text-muted">Requires step-up (passkey)</p>
          </div>
        </div>
      </section>

      {data.profiles.doctor ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Doctor profile" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Specialization"><p>{data.profiles.doctor.specialization}</p></Field>
            <Field label="SLMC #"><p>{data.profiles.doctor.slmcRegistrationNo || "—"}</p></Field>
            <Field label="SLMC verified"><p>{data.profiles.doctor.slmcVerifiedAt ? new Date(data.profiles.doctor.slmcVerifiedAt).toLocaleString() : "No"}</p></Field>
            <Field label="Rating"><p>{data.profiles.doctor.rating ?? "—"}</p></Field>
          </dl>
        </section>
      ) : null}

      {data.profiles.hospital ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Hospital" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Name"><p>{data.profiles.hospital.name}</p></Field>
            <Field label="License"><p>{data.profiles.hospital.license || "—"}</p></Field>
          </dl>
        </section>
      ) : null}

      {data.profiles.clinic ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Clinic" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Name"><p>{data.profiles.clinic.name}</p></Field>
            <Field label="License"><p>{data.profiles.clinic.license || "—"}</p></Field>
          </dl>
        </section>
      ) : null}

      <NotesPanel userId={id} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}