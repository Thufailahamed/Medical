"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { LabOrderForm } from "@/portal/components/labs/LabOrderForm";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";

interface LabOrder {
  id: string;
  patientId: string;
  status: string;
  priority: string;
  tests: string[] | string;
  notes?: string | null;
  orderedAt?: string | null;
}

interface LabList {
  orders: LabOrder[];
  count: number;
}

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger" | "violet"> = {
  ordered: "warn",
  accepted: "brand",
  collected: "brand",
  processing: "brand",
  completed: "success",
  cancelled: "danger",
};

export default function LabOrdersTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "lab-orders", "all"],
    queryFn: () => api<LabList>(`/doctor-portal/lab-orders?limit=200`),
  });
  const rows = (data?.orders ?? []).filter((o) => o.patientId === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setOpen(true)}>
          {t("labs.newOrder")}
        </Button>
      </div>
      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("labs.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((o) => {
              const tests = Array.isArray(o.tests) ? o.tests : safeJson(o.tests);
              return (
                <li
                  key={o.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  <FlaskConical size={14} className="text-violet shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">
                      {tests.join(", ") || t("labs.untitled")}
                    </div>
                    {o.notes ? (
                      <div className="text-xs text-text-soft truncate">{o.notes}</div>
                    ) : null}
                  </div>
                  <Pill tone={o.priority === "urgent" || o.priority === "stat" ? "danger" : "neutral"}>
                    {o.priority}
                  </Pill>
                  <Pill tone={STATUS_TONE[o.status] ?? "neutral"}>{o.status}</Pill>
                  {o.orderedAt ? (
                    <span className="text-xs text-text-muted shrink-0">
                      {formatDateTime(o.orderedAt)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("labs.newOrder")}
        size="lg"
      >
        <LabOrderForm
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}