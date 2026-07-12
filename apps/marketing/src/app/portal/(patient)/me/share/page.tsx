"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Share2,
  Copy,
  Check,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Input, Select } from "@/portal/components/ui/Form";
import { Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDateTime, relativeTime } from "@/portal/lib/format";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastViewedAt: string | null;
}

export default function PatientSharePage() {
  const t = useT();
  const qc = useQueryClient();
  const [hours, setHours] = useState("24");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const EXPIRY_OPTIONS = [
    { value: "1", label: t("patientPortal.share.expiry1h") },
    { value: "24", label: t("patientPortal.share.expiry24h") },
    { value: "168", label: t("patientPortal.share.expiry1w") },
    { value: "720", label: t("patientPortal.share.expiry30d") },
  ];

  const list = useQuery({
    queryKey: ["share", "links"],
    queryFn: () => api<{ links: ShareLink[] }>("/share/links"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ link: ShareLink; url: string; expiresAt: string }>("/share/links", {
        method: "POST",
        json: {
          expiresInHours: Number(hours),
          label: label.trim() || undefined,
          scope: "all",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
      setLabel("");
      toast.success(t("patientPortal.share.created"));
    },
    onError: (err: any) => {
      toast.error(t("patientPortal.share.createFailed"), err?.message);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/share/links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
      toast.success(t("patientPortal.share.revoked"));
    },
  });

  const links = list.data?.links ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-text">
          {t("patientPortal.share.title")}
        </h1>
        <p className="text-sm text-text-soft mt-0.5">
          {t("patientPortal.share.subtitle")}
        </p>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-text mb-3">
          {t("patientPortal.share.newLink")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-text-soft block mb-1">
              {t("patientPortal.share.label")}
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("patientPortal.share.labelPlaceholder")}
            />
          </div>
          <div>
            <label className="text-xs text-text-soft block mb-1">
              {t("patientPortal.share.expiresIn")}
            </label>
            <Select value={hours} onChange={(e) => setHours(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => create.mutate()}
            loading={create.isPending}
          >
            {t("patientPortal.share.create")}
          </Button>
        </div>
      </Card>

      <h2 className="text-sm font-semibold text-text">
        {t("patientPortal.share.existing")}
      </h2>
      {list.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : links.length === 0 ? (
        <Card>
          <div className="text-center py-6 text-sm text-text-soft">
            {t("patientPortal.share.empty")}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {links.map((l) => {
            const url =
              typeof window !== "undefined"
                ? `${window.location.origin}/share/${l.token}`
                : `/share/${l.token}`;
            const expired = new Date(l.expiresAt) < new Date();
            return (
              <Card key={l.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Share2 size={16} className="text-text-muted shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text">
                        {l.label || t("patientPortal.share.untitled")}
                      </span>
                      {l.revoked ? (
                        <Pill tone="danger">
                          {t("patientPortal.share.statusRevoked")}
                        </Pill>
                      ) : expired ? (
                        <Pill tone="warn">
                          {t("patientPortal.share.statusExpired")}
                        </Pill>
                      ) : (
                        <Pill tone="success">
                          {t("patientPortal.share.statusActive")}
                        </Pill>
                      )}
                    </div>
                    <p className="text-xs text-text-soft mt-0.5 truncate">
                      {url}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {relativeTime(l.createdAt)} ·{" "}
                      {t("patientPortal.share.expires")}{" "}
                      {formatDateTime(l.expiresAt)}
                      {l.lastViewedAt
                        ? ` · ${t("patientPortal.share.lastViewed")} ${relativeTime(l.lastViewedAt)}`
                        : ""}
                    </p>
                  </div>
                  {!l.revoked && !expired ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          await navigator.clipboard
                            .writeText(url)
                            .catch(() => {});
                          setCopied(l.id);
                          setTimeout(() => setCopied(null), 1500);
                        }}
                        aria-label={t("common.copyLink")}
                      >
                        {copied === l.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </Button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text-muted hover:text-text"
                        aria-label={t("common.openLink")}
                      >
                        <ExternalLink size={14} />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => revoke.mutate(l.id)}
                        aria-label={t("common.revoke")}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
