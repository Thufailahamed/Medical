"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { FollowUpForm } from "@/portal/components/followups/FollowUpForm";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

interface FollowUp {
  id: string;
  patientId: string;
  title: string;
  followUpDate: string;
  notes?: string | null;
  status?: string;
}

interface FollowUpsResponse {
  followUps: FollowUp[];
  count: number;
}

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger"> = {
  scheduled: "brand",
  reminded: "warn",
  completed: "success",
  missed: "danger",
  cancelled: "neutral",
};

export default function FollowUpsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "follow-ups", "all"],
    queryFn: () => api<FollowUpsResponse>(`/doctor-portal/follow-ups?limit=200`),
  });
  const rows = (data?.followUps ?? []).filter((f) => f.patientId === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setOpen(true)}>
          {t("followups.newFollowup")}
        </Button>
      </div>
      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("followups.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <CalendarCheck size={14} className="text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{f.title}</div>
                  {f.notes ? (
                    <div className="text-xs text-text-soft truncate">{f.notes}</div>
                  ) : null}
                </div>
                <Pill tone={STATUS_TONE[f.status ?? "scheduled"] ?? "neutral"}>
                  {f.status ?? "scheduled"}
                </Pill>
                <span className="text-xs text-text-muted shrink-0">
                  {formatDate(f.followUpDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("followups.newFollowup")}
        size="md"
      >
        <FollowUpForm
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}