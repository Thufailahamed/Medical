"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";

export default function WalkInsPage() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["walkIns"],
    queryFn: () => api<{ walkIns: any[] }>("/walk-ins"),
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/walk-ins", { method: "POST", json: body }).then((r) => r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkIns"] });
      setPatientId("");
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
        title={tr(locale, "nav.walkIns")}
        subtitle={tr(locale, "reception.walkInSubtitle")}
      />

      <Card>
        <h3 className="mb-2 text-sm font-medium">{tr(locale, "reception.addWalkIn")}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!patientId) return;
            create.mutate({ patientId, reason });
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            required
            placeholder={tr(locale, "reception.patientIdPlaceholder")}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <input
            placeholder={tr(locale, "reception.reason")}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            {tr(locale, "common.add")}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">{tr(locale, "reception.queueNow")}</h3>
        {list.isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
        ) : waiting.length === 0 ? (
          <Empty title={tr(locale, "reception.noWalkIns")} />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {waiting.map((w: any, i: number) => (
              <li key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    #{i + 1} · {w.patientName ?? w.patientId}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {w.reason ?? "—"} · {formatTime(w.createdAt, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="warning">{tr(locale, "reception.waiting")}</Pill>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => callNext.mutate(w.id)}
                  >
                    {tr(locale, "reception.callNext")}
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