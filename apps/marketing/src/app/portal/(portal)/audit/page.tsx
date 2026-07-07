"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Pill,
  FlaskConical,
  FileText,
  User,
  Activity,
  ChevronRight,
  ShieldCheck,
  ScrollText,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

type ResourceFilter = "all" | "prescription" | "lab_order" | "patient" | "note" | "other";
type ActionFilter = "all" | "create" | "sign" | "cancel" | "update" | "dispense";

const RESOURCE_VALUES: ResourceFilter[] = [
  "all",
  "prescription",
  "lab_order",
  "patient",
  "note",
  "other",
];

const ACTION_VALUES: ActionFilter[] = [
  "all",
  "create",
  "sign",
  "cancel",
  "update",
  "dispense",
];

const RESOURCE_ICON: Record<string, typeof Pill> = {
  prescription: Pill,
  lab_order: FlaskConical,
  patient: User,
  note: FileText,
  clinical_note: FileText,
  vitals: Activity,
  follow_up: ScrollText,
};

function toneFor(action: string): "neutral" | "brand" | "success" | "warn" | "danger" {
  if (/cancel|delete|revoke/.test(action)) return "danger";
  if (/sign|dispense|complete/.test(action)) return "success";
  if (/update|edit/.test(action)) return "warn";
  return "brand";
}

export default function AuditPage() {
  const t = useT();
  const [resource, setResource] = useState<ResourceFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: qk.auditMe({ limit: 200 }),
    queryFn: () =>
      api<{ auditLogs: AuditLog[] }>("/audit/me?limit=200"),
  });

  const rows = useMemo(() => {
    const all = data?.auditLogs ?? [];
    return all.filter((r) => {
      if (resource !== "all") {
        if (resource === "other") {
          if (["prescription", "lab_order", "patient", "clinical_note"].includes(r.resource))
            return false;
        } else if (r.resource !== resource) {
          return false;
        }
      }
      if (action !== "all" && !r.action.toLowerCase().includes(action)) {
        return false;
      }
      return true;
    });
  }, [data, resource, action]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
        icon={<ClipboardList size={18} className="text-brand" />}
        badge={
          rows.length > 0 ? (
            <span className="text-[11px] font-semibold text-text-muted">
              {rows.length}
            </span>
          ) : undefined
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-surface">
        <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30 flex flex-wrap items-center gap-3">
          <FilterPills<ResourceFilter>
            value={resource}
            onChange={setResource}
            options={RESOURCE_VALUES.map((v) => ({
              value: v,
              label: t(`audit.filter.resource.${v}`),
            }))}
          />
          <FilterPills<ActionFilter>
            value={action}
            onChange={setAction}
            options={ACTION_VALUES.map((v) => ({
              value: v,
              label: t(`audit.filter.action.${v}`),
            }))}
          />
        </div>

        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("audit.empty")} icon={<ClipboardList size={20} className="text-text-muted" />} className="py-16" />
        ) : (
          <ul className="flex flex-col divide-y divide-border/40">
            {rows.map((r) => {
              const Icon = RESOURCE_ICON[r.resource] ?? ClipboardList;
              return (
                <li key={r.id} className="px-5 py-3.5 hover:bg-surface-2/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-surface-2 text-text-soft flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PillBadge tone={toneFor(r.action)}>
                          {labelForAction(t, r.action)}
                        </PillBadge>
                        <span className="text-sm font-medium text-text">
                          {t(`audit.col.resource`)}: {r.resource}
                          {r.resourceId ? (
                            <span className="text-text-muted font-mono text-[11px] ml-1">
                              #{r.resourceId.slice(0, 8)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {formatDateTime(r.createdAt)}
                        {r.ip ? <> · {r.ip}</> : null}
                      </div>
                    </div>
                    <Link
                      href={resourceLink(r)}
                      className="portal-btn portal-btn-ghost portal-btn-sm shrink-0"
                    >
                      {r.resource === "prescription"
                        ? t("audit.openPrescription")
                        : r.resource === "lab_order"
                          ? t("audit.openPatient")
                          : t("common.view")}
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function resourceLink(r: AuditLog): string {
  switch (r.resource) {
    case "prescription":
      return `/portal/verify/${r.resourceId ?? ""}`;
    case "lab_order":
      return "/portal/lab-orders";
    case "clinical_note":
      return "/portal/clinical-notes";
    case "patient":
      return r.resourceId ? `/portal/patients/${r.resourceId}` : "/portal/patients";
    case "vitals":
      return r.resourceId ? `/portal/patients/${r.resourceId}/vitals` : "/portal/patients";
    default:
      return "/portal/dashboard";
  }
}

/** Map an action string to a localised label, with sensible fallbacks. */
function labelForAction(t: (k: string) => string, action: string): string {
  const a = action.toLowerCase();
  if (a.includes("sign")) return t("audit.actions.sign");
  if (a.includes("cancel")) return t("audit.actions.cancel");
  if (a.includes("dispense")) return t("audit.actions.dispense");
  if (a.includes("complete") && a.includes("lab")) return t("audit.actions.completeLab");
  if (a.includes("create") || a.includes("add") || a.includes("new")) return t("audit.actions.create");
  if (a.includes("update") || a.includes("edit")) return t("audit.actions.update");
  return t("audit.actions.other");
}