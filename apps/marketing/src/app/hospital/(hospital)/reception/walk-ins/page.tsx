"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";

export default function WalkInsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const activeHospitalId = useAuthStore((s) => s.activeHospitalId);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["walkIns"],
    queryFn: () => api<{ walkIns: any[] }>("/walk-ins"),
  });

  const doctorsQuery = useQuery({
    queryKey: ["hospitalDoctors", activeHospitalId],
    queryFn: () =>
      activeHospitalId
        ? api<any[]>(`/hospital-doctors?hospitalId=${activeHospitalId}`)
        : Promise.resolve([]),
    enabled: !!activeHospitalId,
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/walk-ins", { method: "POST", json: body }).then((r) => r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkIns"] });
      setPatientId("");
      setDoctorId("");
      setReason("");
      toast.success("Added to queue");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const callNext = useMutation({
    mutationFn: (id: string) =>
      api(`/walk-ins/${id}/call`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["walkIns"] }),
  });

  const waiting = list.data?.walkIns?.filter((w: any) => w.status === "waiting") ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.walkIns")}
        subtitle={t("reception.walkInSubtitle")}
      />

      <Card>
        <CardHeader
          title={t("reception.addWalkIn")}
          icon={<Plus size={15} className="text-brand" />}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!patientId || !doctorId) return;
            create.mutate({ patientId, doctorId, reason });
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            required
            placeholder={t("reception.patientIdPlaceholder")}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <select
            required
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">{t("reception.selectDoctor")}</option>
            {(doctorsQuery.data || []).map((doc: any) => (
              <option key={doc.doctorId} value={doc.doctorId}>
                {doc.name} ({doc.specialization})
              </option>
            ))}
          </select>
          <input
            placeholder={t("reception.reason")}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            <Plus size={14} className="mr-1.5" />
            {t("common.add")}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={t("reception.queueNow")}
          icon={<ClipboardList size={15} className="text-brand" />}
          right={
            waiting.length > 0 ? (
              <Pill tone="warn">{waiting.length} {t("reception.waiting")}</Pill>
            ) : null
          }
        />
        {list.isLoading ? (
          <p className="mt-3 text-sm text-text-muted">{t("common.loading")}</p>
        ) : waiting.length === 0 ? (
          <div className="mt-3">
            <Empty title={t("reception.noWalkIns")} />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {waiting.map((w: any, i: number) => (
              <li key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-text">
                    <span className="text-text-muted">#{i + 1}</span> ·{" "}
                    {w.patientName ?? w.patientId}
                  </p>
                  <p className="text-xs text-text-muted">
                    {w.reason ?? "—"} · {formatTime(w.createdAt, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="warn">{t("reception.waiting")}</Pill>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => callNext.mutate(w.id)}
                  >
                    <ChevronRight size={12} className="mr-1" />
                    {t("reception.callNext")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}