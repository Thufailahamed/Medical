"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, UserPlus, Search, ChevronRight } from "lucide-react";
import Link from "next/link";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { Avatar } from "@/portal/components/ui/Avatar";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface Member {
  id: string;
  patientId: string;
  patientName: string;
  patientPhoto?: string | null;
  role: string;
  scope: string;
  grantedAt?: string;
  expiresAt?: string | null;
  active?: boolean;
}

interface InviteResponse {
  members?: Member[];
  grants?: Member[];
}

export default function CareTeamPage() {
  const t = useT();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["care-team"],
    queryFn: () => api<InviteResponse>(`/care-team`),
  });

  const members: Member[] = (data?.members ?? data?.grants ?? []) as Member[];

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/care-team/${id}`, { method: "PATCH", json: { status: "revoked" } }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["care-team"] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("careTeam.title")}
        subtitle={t("careTeam.subtitle")}
        icon={<UserPlus size={18} className="text-indigo-600" />}
        actions={
          <Button
            size="sm"
            leftIcon={<UserPlus size={14} />}
            onClick={() => setInviteOpen(true)}
          >
            {t("careTeam.invite")}
          </Button>
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : members.length === 0 ? (
          <Empty title={t("careTeam.empty")} className="m-4" />
        ) : (
          <ul className="flex flex-col">
            {members.map((m) => (
              <li key={m.id} className="group flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldOff size={18} />
                </div>
                <Avatar name={m.patientName} src={m.patientPhoto ?? undefined} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {m.patientName}
                  </div>
                  <div className="text-xs text-text-soft">
                    {m.role} · {m.scope}
                    {m.grantedAt ? ` · since ${formatDate(m.grantedAt)}` : ""}
                  </div>
                </div>
                {m.active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
                <Link
                  href={`/portal/patients/${m.patientId}`}
                  className="text-xs text-brand font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  Open
                  <ChevronRight size={12} />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<ShieldOff size={12} />}
                  onClick={() => {
                    if (confirm(`Revoke access for ${m.patientName}?`)) revoke.mutate(m.id);
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {inviteOpen ? (
        <Card className="rounded-2xl border-border/50">
          <CardHeader title={t("careTeam.inviteTitle")} />
          <InviteForm
            onSaved={() => {
              setInviteOpen(false);
              qc.invalidateQueries({ queryKey: ["care-team"] });
            }}
            onCancel={() => setInviteOpen(false)}
          />
        </Card>
      ) : null}
    </div>
  );
}

function InviteForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [scope, setScope] = useState("read");
  const [role, setRole] = useState("specialist");
  const [days, setDays] = useState("365");

  const { data } = useQuery({
    queryKey: ["doctor", "search-patients", q],
    queryFn: () =>
      api<{ patients: Array<{ patient: { id: string }; user: { name: string } }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: q.length > 0,
  });

  const create = useMutation({
    mutationFn: () =>
      api(`/care-team`, {
        method: "POST",
        json: {
          patientId,
          scope,
          role,
          expiresInDays: Number(days) || null,
        },
      }),
    onSuccess: () => {
      toast.success("Invite sent");
      onSaved();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Search patient"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name or NIC"
      />
      {data?.patients && data.patients.length > 0 && !patientId ? (
        <ul className="border border-border/60 rounded-xl divide-y divide-border/50 max-h-40 overflow-y-auto">
          {data.patients.map((p) => (
            <li key={p.patient.id}>
              <button
                type="button"
                onClick={() => {
                  setPatientId(p.patient.id);
                  setQ(p.user.name);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2/40 flex items-center gap-2 transition-colors"
              >
                <Avatar name={p.user.name} size="xs" />
                <span className="truncate">{p.user.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {patientId ? (
        <div className="text-xs text-success">Patient selected · {patientId.slice(0, 8)}...</div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <Select
          label="Scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          options={[
            { value: "read", label: "Read" },
            { value: "read_write", label: "Read + Write" },
          ]}
        />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "primary_care", label: "Primary care" },
            { value: "specialist", label: "Specialist" },
            { value: "consultant", label: "Consultant" },
          ]}
        />
        <Input
          label="Valid for (days)"
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="365"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          leftIcon={<UserPlus size={14} />}
          disabled={!patientId || create.isPending}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Invite
        </Button>
      </div>
    </div>
  );
}
