"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Share2,
  Link as LinkIcon,
  Copy,
  Trash2,
  Check,
  Plus,
  Clock,
  ExternalLink,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import {
  ChartTabHeader,
  ChartList,
  ChartEmpty,
} from "@/portal/components/chart";
import { useT } from "@/portal/i18n";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastViewedAt: string | null;
  patientId: string;
  patientName?: string | null;
  patientNic?: string | null;
}

interface CreateResponse {
  link: ShareLink;
  token: string;
  url: string;
  expiresAt: string;
}

const EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "1 week" },
  { value: "720", label: "30 days" },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "Full record" },
  { value: "recent6m", label: "Recent 6 months" },
];

export default function ShareTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [scope, setScope] = useState("all");
  const [lastCreated, setLastCreated] = useState<CreateResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // List links for this patient (filter on the client after fetching all
  // doctor's links — the list endpoint is shared across patients so we
  // avoid a backend filter round-trip).
  const { data, isLoading } = useQuery({
    queryKey: qk.shareDoctorLinks,
    queryFn: () => api<{ links: ShareLink[] }>("/doctor-portal/share/links"),
  });

  const links = (data?.links ?? []).filter((l) => l.patientId === id);

  const create = useMutation({
    mutationFn: async () => {
      return api<CreateResponse>("/doctor-portal/share/links", {
        method: "POST",
        json: {
          patientId: id,
          label: label.trim() || undefined,
          expiresInHours: Number(expiresInHours),
          scope,
        },
      });
    },
    onSuccess: (res) => {
      setLastCreated(res);
      setLabel("");
      qc.invalidateQueries({ queryKey: qk.shareDoctorLinks });
      toast.success(t("share.created"));
    },
    onError: (e: any) => {
      toast.error(e?.message ?? t("share.createError"));
    },
  });

  const revoke = useMutation({
    mutationFn: async (linkId: string) => {
      return api(`/doctor-portal/share/links/${linkId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast.success(t("share.revoked"));
      qc.invalidateQueries({ queryKey: qk.shareDoctorLinks });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? t("share.revokeError"));
    },
  });

  async function copyUrl(link: ShareLink) {
    const url = `${window.location.origin}/share/${link.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(link.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error(t("share.copyError"));
    }
  }

  function statusFor(l: ShareLink): {
    tone: "neutral" | "success" | "danger" | "warn";
    label: string;
  } {
    if (l.revoked) return { tone: "danger", label: t("share.status.revoked") };
    if (new Date(l.expiresAt) < new Date())
      return { tone: "neutral", label: t("share.status.expired") };
    return { tone: "success", label: t("share.status.active") };
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Share2 size={18} />}
        title={t("share.tab.title")}
        subtitle={t("share.tab.subtitle", { count: links.length })}
        badge={{ count: links.length, tone: "brand" }}
      />

      {/* Create form */}
      <Card padding={false}>
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-brand text-white flex items-center justify-center">
              <Plus size={13} />
            </div>
            <span className="text-xs font-semibold text-text uppercase tracking-wider">
              {t("share.createTitle")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,160px,auto] gap-3">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("share.labelPlaceholder")}
              maxLength={100}
            />
            <Select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              options={EXPIRY_OPTIONS}
            />
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              options={SCOPE_OPTIONS}
            />
            <Button
              variant="primary"
              onClick={() => create.mutate()}
              loading={create.isPending}
              leftIcon={<LinkIcon size={13} />}
            >
              {t("share.create")}
            </Button>
          </div>

          {/* Last created URL — only renders after a successful create */}
          {lastCreated ? (
            <div className="mt-3 rounded-lg border border-success/30 bg-success-soft/60 px-3 py-2.5 flex items-center gap-2">
              <LinkIcon size={13} className="text-success shrink-0" />
              <code className="flex-1 min-w-0 text-[11px] text-text font-mono truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/share/${lastCreated.token}`
                  : `/share/${lastCreated.token}`}
              </code>
              <button
                type="button"
                onClick={async () => {
                  const url = `${window.location.origin}/share/${lastCreated.token}`;
                  await navigator.clipboard.writeText(url);
                  setCopiedToken(lastCreated.token);
                  setTimeout(() => setCopiedToken(null), 2000);
                }}
                className="text-text-muted hover:text-text"
              >
                {copiedToken === lastCreated.token ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              <a
                href={`/share/${lastCreated.token}`}
                target="_blank"
                rel="noreferrer"
                className="text-text-muted hover:text-text"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          ) : null}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <ChartEmpty
            icon={<Share2 size={20} />}
            title={t("share.empty")}
            description={t("share.emptyBody")}
          />
        ) : (
          <ChartList
            items={links}
            isLoading={false}
            isEmpty={false}
            emptyState={null}
            renderRow={(l) => {
              const s = statusFor(l);
              const expired = s.tone === "neutral" || s.tone === "danger";
              return (
                <div
                  key={l.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0",
                    expired && "opacity-60",
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <LinkIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text truncate">
                        {l.label || t("share.untitled")}
                      </span>
                      <Pill tone={s.tone}>{s.label}</Pill>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 inline-flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />
                        {t("share.expiresAt", {
                          when: relativeTime(l.expiresAt),
                        })}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(l.createdAt)}</span>
                      {l.lastViewedAt ? (
                        <>
                          <span>·</span>
                          <span>
                            {t("share.lastViewed", {
                              when: relativeTime(l.lastViewedAt),
                            })}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyUrl(l)}
                      className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-text"
                      title={t("share.copyUrl")}
                    >
                      {copiedToken === l.token ? (
                        <Check size={14} className="text-success" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    {l.revoked ? null : (
                      <button
                        type="button"
                        onClick={() => revoke.mutate(l.id)}
                        disabled={revoke.isPending}
                        className="p-1.5 rounded-md hover:bg-danger-soft text-text-muted hover:text-danger disabled:opacity-50"
                        title={t("share.revoke")}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}