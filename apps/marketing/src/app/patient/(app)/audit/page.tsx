"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText, Activity } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorName?: string | null;
  details: string | null;
  createdAt: string;
}

/**
 * Patient-visible audit log.
 *
 * Reuses the same backend endpoint as the doctor portal but limits the
 * read to entries where the patient is the resource owner. The
 * backend filters on server-side; this view simply renders the
 * returned rows in a recent-first list.
 */
export default function PatientAuditPage() {
  const t = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", "me"],
    queryFn: () => api<{ entries: AuditEntry[] }>("/audit/me?limit=200"),
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-text">
          {t("patientPortal.audit.title")}
        </h1>
        <p className="text-sm text-text-soft mt-0.5">
          {t("patientPortal.audit.subtitle")}
        </p>
      </header>

      {error ? (
        <Card>
          <div className="text-sm text-danger">
            {t("patientPortal.audit.loadError")}
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <ScrollText size={28} className="mx-auto text-text-muted" />
            <p className="text-sm text-text-soft mt-2">
              {t("patientPortal.audit.empty")}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-border/50">
            {entries.map((e) => (
              <li
                key={e.id}
                className="px-4 py-3 flex items-start gap-3"
              >
                <div className="h-8 w-8 rounded-md bg-surface-2 text-text-soft flex items-center justify-center shrink-0">
                  <Activity size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text">
                      {e.action}
                    </span>
                    <Pill tone="neutral">{e.resource}</Pill>
                  </div>
                  <p className="text-xs text-text-soft mt-0.5">
                    {e.actorName ||
                      e.actorId ||
                      t("patientPortal.audit.actorSystem")}{" "}
                    · {formatDateTime(e.createdAt)}
                  </p>
                  {e.details ? (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                      {e.details}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
