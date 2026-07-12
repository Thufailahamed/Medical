"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, UserPlus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import {
  RHFFormProvider,
  RHFInput,
  RHFSelect,
} from "@/portal/components/ui/FormKit";
import { Avatar } from "@/portal/components/ui/Avatar";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

const inviteSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  patientQuery: z.string().optional(),
  scope: z.enum(["read", "read_write"]),
  role: z.enum(["primary_care", "specialist", "consultant"]),
  days: z
    .string()
    .refine((v) => !v || /^\d+$/.test(v), { message: "Must be a positive number" })
    .refine((v) => !v || Number(v) > 0, { message: "Must be greater than 0" })
    .refine((v) => !v || Number(v) <= 3650, { message: "Must be 3650 days or fewer" }),
});

type InviteValues = z.infer<typeof inviteSchema>;

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
      toast.success(t("careTeam.accessRevoked"));
      qc.invalidateQueries({ queryKey: ["care-team"] });
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
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
                    {m.grantedAt
                      ? ` · ${t("careTeam.since", { date: formatDate(m.grantedAt) })}`
                      : ""}
                  </div>
                </div>
                {m.active ? (
                  <Pill tone="success">{t("common.active")}</Pill>
                ) : (
                  <Pill tone="neutral">{t("common.inactive")}</Pill>
                )}
                <Link
                  href={`/portal/patients/${m.patientId}`}
                  className="text-xs text-brand font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  {t("common.open")}
                  <ChevronRight size={12} />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<ShieldOff size={12} />}
                  onClick={() => {
                    if (confirm(t("careTeam.revokeConfirm", { name: m.patientName })))
                      revoke.mutate(m.id);
                  }}
                >
                  {t("careTeam.revoke")}
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
  const t = useT();
  const [q, setQ] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["doctor", "search-patients", q],
    queryFn: () =>
      api<{ patients: Array<{ patient: { id: string }; user: { name: string } }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: q.length > 0,
  });

  const create = useMutation({
    mutationFn: (values: InviteValues) =>
      api(`/care-team`, {
        method: "POST",
        json: {
          patientId: values.patientId,
          scope: values.scope,
          role: values.role,
          expiresInDays: values.days ? Number(values.days) : null,
        },
      }),
    onSuccess: () => {
      toast.success(t("careTeam.inviteSent"));
      onSaved();
    },
    onError: (err: any) => toast.error(t("toast.error"), err?.message),
  });

  return (
    <RHFFormProvider
      schema={inviteSchema}
      defaultValues={{
        patientId: "",
        patientQuery: "",
        scope: "read",
        role: "specialist",
        days: "365",
      }}
      mode="onSubmit"
    >
      {(form) => (
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="flex flex-col gap-3"
        >
          <Input
            label={t("careTeam.searchPatient")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("careTeam.searchPlaceholder")}
          />
          {data?.patients && data.patients.length > 0 && !form.watch("patientId") ? (
            <ul className="border border-border/60 rounded-xl divide-y divide-border/50 max-h-40 overflow-y-auto">
              {data.patients.map((p) => (
                <li key={p.patient.id}>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("patientId", p.patient.id, { shouldValidate: true });
                      setQ(p.user.name);
                      setSelectedName(p.user.name);
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
          {selectedName ? (
            <div className="text-xs text-success">
              {t("careTeam.patientSelected", { id: selectedName })}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <RHFSelect
              name="scope"
              label={t("careTeam.scope")}
              options={[
                { value: "read", label: t("careTeam.scopeRead") },
                { value: "read_write", label: t("careTeam.scopeReadWrite") },
              ]}
            />
            <RHFSelect
              name="role"
              label={t("careTeam.role")}
              options={[
                { value: "primary_care", label: t("careTeam.rolePrimaryCare") },
                { value: "specialist", label: t("careTeam.roleSpecialist") },
                { value: "consultant", label: t("careTeam.roleConsultant") },
              ]}
            />
            <RHFInput
              name="days"
              label={t("careTeam.validForDays")}
              type="number"
              placeholder="365"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
            <Button
              type="submit"
              leftIcon={<UserPlus size={14} />}
              loading={create.isPending}
            >
              {t("careTeam.invite")}
            </Button>
          </div>
        </form>
      )}
    </RHFFormProvider>
  );
}
