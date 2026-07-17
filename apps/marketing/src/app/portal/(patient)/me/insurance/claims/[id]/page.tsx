"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Paperclip,
  MessageCircle,
  FileText,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Field, Textarea } from "@/portal/components/ui/Form";
import { formatDate, formatLkr } from "@/portal/lib/format";

interface ClaimDetail {
  claim: {
    id: string;
    claimNumber: string | null;
    status: string;
    treatmentType: string;
    incurringFacility: string | null;
    admissionDate: string | null;
    dischargeDate: string | null;
    diagnosis: string | null;
    claimedAmountLkr: number;
    approvedAmountLkr: number | null;
    insurerRemarks: string | null;
    submittedAt: string | null;
    enrollmentId: string;
    planName?: string;
    providerName?: string;
    policyNumber?: string | null;
  };
  documents?: Array<{
    id: string;
    kind: string;
    fileKey: string;
    fileName?: string;
  }>;
  messages?: Array<{
    id: string;
    body: string;
    senderRole: string;
    createdAt: string;
  }>;
}

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info" | "neutral"> = {
  submitted: "info",
  under_review: "warn",
  more_info_needed: "warn",
  approved: "success",
  rejected: "danger",
  paid: "success",
};

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const q = useQuery({
    queryKey: ["insurance", "claim", id],
    queryFn: () =>
      api<ClaimDetail>(`/insurance-marketplace/claims/${id}`),
  });

  const replyMut = useMutation({
    mutationFn: () =>
      api(`/insurance-marketplace/claims/${id}/messages`, {
        method: "POST",
        json: { body: reply },
      }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["insurance", "claim", id] });
    },
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const c = q.data?.claim;
  if (!c) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">Claim not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/portal/me/insurance/claims"
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to claims
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-text-soft">{c.providerName}</div>
            <h1 className="text-xl font-bold text-text mt-0.5">
              {c.claimNumber ?? `Claim ${c.id.slice(0, 8)}`}
            </h1>
            <p className="text-sm text-text-soft">
              {c.planName} · Policy {c.policyNumber ?? "—"}
            </p>
          </div>
          <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>
            {c.status.replace(/_/g, " ")}
          </Pill>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/60">
          <Metric label="Treatment" value={c.treatmentType.replace(/_/g, " ")} />
          <Metric label="Claimed" value={formatLkr(c.claimedAmountLkr)} />
          <Metric
            label="Approved"
            value={c.approvedAmountLkr != null ? formatLkr(c.approvedAmountLkr) : "—"}
          />
          <Metric
            label="Submitted"
            value={c.submittedAt ? formatDate(c.submittedAt) : "—"}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-text mb-2">Treatment details</h2>
          <div className="space-y-2 text-sm">
            <Row label="Facility" value={c.incurringFacility ?? "—"} />
            <Row
              label="Admission"
              value={c.admissionDate ? formatDate(c.admissionDate) : "—"}
            />
            <Row
              label="Discharge"
              value={c.dischargeDate ? formatDate(c.dischargeDate) : "—"}
            />
            <Row label="Diagnosis" value={c.diagnosis ?? "—"} />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-text mb-2">Insurer remarks</h2>
          {c.insurerRemarks ? (
            <p className="text-sm text-text-soft">{c.insurerRemarks}</p>
          ) : (
            <p className="text-sm text-text-muted italic">
              No remarks from the insurer yet.
            </p>
          )}
        </Card>
      </div>

      {q.data?.documents && q.data.documents.length > 0 ? (
        <Card>
          <h2 className="font-bold text-text mb-3">Documents</h2>
          <ul className="space-y-1.5">
            {q.data.documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-md text-sm"
              >
                <FileText size={14} className="text-text-muted" />
                <span className="flex-1 truncate text-text">
                  {d.fileName ?? d.kind}
                </span>
                <span className="text-[11px] text-text-muted">{d.kind}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-bold text-text mb-3 flex items-center gap-2">
          <MessageCircle size={14} />
          Conversation
        </h2>
        {q.data?.messages && q.data.messages.length > 0 ? (
          <ul className="space-y-2 mb-4">
            {q.data.messages.map((m) => (
              <li
                key={m.id}
                className={`px-3 py-2 rounded-md text-sm ${
                  m.senderRole === "patient"
                    ? "bg-brand-soft ml-8"
                    : "bg-surface-2 mr-8"
                }`}
              >
                <div className="text-[11px] text-text-muted">
                  {m.senderRole} · {formatDate(m.createdAt)}
                </div>
                <div className="text-text mt-0.5">{m.body}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted italic mb-4">
            No messages yet. Send the first reply.
          </p>
        )}
        <Field label="Reply">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your message…"
            rows={3}
          />
        </Field>
        <div className="flex justify-end mt-3">
          <Button
            onClick={() => replyMut.mutate()}
            disabled={!reply.trim()}
            loading={replyMut.isPending}
            size="sm"
          >
            <Send size={14} />
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-semibold text-text mt-0.5 capitalize">
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-soft shrink-0">{label}</span>
      <span className="text-text font-medium text-right">{value}</span>
    </div>
  );
}