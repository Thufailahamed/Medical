"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/portal/lib/api";
import { useEffect, useState } from "react";
import {
  Activity,
  User,
  Globe,
  ChevronRight,
  Eye,
  Download,
  Edit3,
  Trash2,
  Plus,
  Check,
  LogIn,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { formatRelative, humanize } from "@/patient/lib/format";

interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  targetType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  ipAddress: string | null;
}

const ACTION_ICONS: Record<string, typeof Eye> = {
  view: Eye,
  download: Download,
  edit: Edit3,
  delete: Trash2,
  create: Plus,
  share: Check,
  login: LogIn,
};

export default function ActivityPage() {
  const query = useQuery<{ activity: ActivityEntry[] }>({
    queryKey: ["patient", "activity", 50],
    queryFn: () => api<{ activity: ActivityEntry[] }>("/activity/me?limit=50"),
  });

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Account"
        title="Activity & audit"
        description="Every action you take on your record, and every time someone you've shared with views it. This is for you, always."
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={5}
          emptyTitle="No activity yet"
          emptyDescription="Once you start using the app, your activity will appear here."
        >
          {(data) => {
            const list = data?.activity ?? [];
            return (
              <ul className="flex flex-col gap-1.5">
                {list.map((a) => {
                  const Icon = ACTION_ICONS[a.action] ?? Activity;
                  return (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 rounded-inner bg-surface-2 p-3"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                        <Icon size={15} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text">
                          {a.actor} {a.action.replace(/_/g, " ")} {a.target}
                        </p>
                        <p className="text-xs text-text-soft">
                          {humanize(a.targetType)}
                          {a.ipAddress ? ` · ${a.ipAddress}` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-text-muted">
                        {formatRelative(a.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}
