"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  UserCheck,
  UserX,
  ChevronRight,
  Shield,
  Clock,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface Relationship {
  id: string;
  patientId: string;
  doctorId: string;
  context: string;
  status: string;
  startDate: string;
  endDate: string | null;
  patient: { id: string; name: string } | null;
}

export default function RelationshipsPage() {
  const t = useT();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-patient-relationships"],
    queryFn: () =>
      api<{ relationships: Relationship[]; count: number }>(
        "/doctor-patient-relationships"
      ),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api(`/doctor-patient-relationships/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success(t("toast.deleted"), "");
      qc.invalidateQueries({ queryKey: ["doctor", "relationships"] });
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const relationships = data?.relationships ?? [];
  const active = relationships.filter((r) => r.status === "active");
  const inactive = relationships.filter((r) => r.status !== "active");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("relationships.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("relationships.subtitle")}</p>
      </div>

      {/* Active Relationships */}
      <Card>
        <CardHeader
          title={t("relationships.active")}
          right={<Pill tone="success">{active.length}</Pill>}
        />
        {isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : active.length === 0 ? (
          <Empty title={t("relationships.noActive")} className="mt-3" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {active.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border"
              >
                <div className="h-9 w-9 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
                  <UserCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {r.patient?.name || t("relationships.unknownPatient")}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    <span className="flex items-center gap-1">
                      <Shield size={10} />
                      {r.context}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(r.startDate)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/portal/patients/${r.patientId}`}>
                    <Button size="sm" variant="ghost" leftIcon={<ChevronRight size={14} />}>
                      {t("patients.openChart")}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<UserX size={14} />}
                    onClick={() => revokeMutation.mutate(r.id)}
                    loading={revokeMutation.isPending}
                  >
                    {t("relationships.revoke")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Inactive Relationships */}
      {inactive.length > 0 && (
        <Card>
          <CardHeader
            title={t("relationships.inactive")}
            right={<Pill tone="neutral">{inactive.length}</Pill>}
          />
          <ul className="mt-3 flex flex-col gap-2">
            {inactive.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border opacity-60"
              >
                <div className="h-9 w-9 rounded-lg bg-surface-2 text-text-muted flex items-center justify-center shrink-0">
                  <UserX size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {r.patient?.name || t("relationships.unknownPatient")}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    <span>{r.context}</span>
                    <span>·</span>
                    <span>{r.status}</span>
                  </div>
                </div>
                <Pill tone="neutral">{r.status}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
