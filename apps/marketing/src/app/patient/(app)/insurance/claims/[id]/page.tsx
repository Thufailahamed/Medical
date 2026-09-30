"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Hospital,
  MessageCircle,
  Receipt,
  Send,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDate, formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HeroAccent,
  HeroOverlap,
  InfoField,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

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
    amountRequestedLkr: number;
    amountApprovedLkr: number | null;
    insurerRemarks: string | null;
    patientRemarks: string | null;
    createdAt: string;
    enrollmentId: string;
    planName?: string | null;
    providerName?: string | null;
    policyNumber?: string | null;
    documents?: Array<{
      id: string;
      kind: string;
      fileKey: string;
      fileName?: string | null;
      contentType?: string | null;
      uploadedAt: string;
    }>;
    messages?: Array<{
      id: string;
      body: string;
      senderRole: "patient" | "operator";
      senderUserId: string;
      createdAt: string;
    }>;
  };
}

const STATUS_TONE: Record<string, Tone> = {
  submitted: "sky",
  under_review: "amber",
  more_info_needed: "amber",
  approved: "emerald",
  rejected: "rose",
  paid: "emerald",
};

const STAGES = ["submitted", "under_review", "approved", "paid"];

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
    queryFn: () => api<ClaimDetail>(`/insurance-marketplace/claims/${id}`),
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

  const c = q.data?.claim;
  const tone = c ? (STATUS_TONE[c.status] ?? "sky") : "sky";
  const stageIdx = c ? STAGES.indexOf(c.status) : -1;

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance/claims"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Claims
        </Link>
      </div>

      {q.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      ) : !c ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<Receipt size={19} />}
            title="Claim not found"
            body="This claim may have been removed or is not linked to your account."
          />
        </section>
      ) : (
        <>
          <PatientHero
            kickerIcon={<Receipt size={13} aria-hidden />}
            kicker="Insurance claim"
            kickerMeta={c.providerName ?? "Insurer"}
            title={
              <>
                {c.claimNumber ?? `Claim ${c.id.slice(0, 8)}`}{" "}
                <HeroAccent>{c.planName ? `· ${c.planName}` : ""}</HeroAccent>
              </>
            }
            description={`${c.treatmentType.replace(/_/g, " ")} · submitted ${formatDate(c.createdAt)}${c.policyNumber ? ` · Policy ${c.policyNumber}` : ""}.`}
            chips={
              <>
                <span className={c.status === "rejected" ? HERO_DANGER_CHIP : HERO_CHIP}>
                  <StatusIcon status={c.status} />
                  <span className="capitalize">{c.status.replace(/_/g, " ")}</span>
                </span>
                <span className={HERO_CHIP}>
                  <Wallet size={12} className="text-sky-300" />
                  {formatLkr(c.amountRequestedLkr)} claimed
                </span>
                {c.amountApprovedLkr != null ? (
                  <span className={HERO_CHIP}>
                    <CheckCircle2 size={12} className="text-emerald-300" />
                    {formatLkr(c.amountApprovedLkr)} approved
                  </span>
                ) : null}
              </>
            }
            actions={
              <>
                <Link href="/patient/insurance/claims/new" className={HERO_GHOST}>
                  <FileText size={13} /> File another
                </Link>
                <Link href={`/patient/insurance/policy/${c.enrollmentId}`} className={HERO_GHOST}>
                  <ShieldCheck size={13} /> View policy
                </Link>
              </>
            }
          />

          <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={<Stethoscope size={16} />}
              tone="bg-sky-50 text-sky-600"
              label="Treatment"
              value={c.treatmentType.replace(/_/g, " ")}
              sub={c.incurringFacility ?? "—"}
            />
            <StatTile
              icon={<Wallet size={16} />}
              tone="bg-violet-50 text-violet-600"
              label="Requested"
              value={formatLkr(c.amountRequestedLkr)}
              sub="Claimed amount"
            />
            <StatTile
              icon={<CheckCircle2 size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              label="Approved"
              value={c.amountApprovedLkr != null ? formatLkr(c.amountApprovedLkr) : "—"}
              sub={c.amountApprovedLkr != null ? "Settlement value" : "Awaiting decision"}
            />
            <StatTile
              icon={<Calendar size={16} />}
              tone="bg-amber-50 text-amber-600"
              label="Submitted"
              value={formatDate(c.createdAt)}
              sub={`${c.documents?.length ?? 0} documents`}
            />
          </HeroOverlap>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex flex-col gap-5 xl:col-span-8">
              {c.status !== "rejected" ? (
                <section className={PANEL}>
                  <PanelHeader
                    icon={<Activity size={16} />}
                    tone="bg-sky-50 text-sky-600"
                    title="Claim progress"
                    caption="Underwriter assessment stages."
                  />
                  <div className="mt-5 flex items-center gap-2">
                    {["Submitted", "Under review", "Approved", "Paid"].map((label, i) => {
                      const done = stageIdx > i || c.status === "paid";
                      const active = stageIdx === i && c.status !== "paid";
                      const isCurrent = active || (c.status === "paid" && i === 3);
                      return (
                        <div key={label} className="flex flex-1 items-center gap-2">
                          <div
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                              done
                                ? "bg-emerald-500 text-white"
                                : isCurrent
                                  ? "bg-sky-600 text-white"
                                  : "bg-slate-100 text-slate-400",
                            )}
                          >
                            {done && !(c.status === "paid" && i === 3) ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              i + 1
                            )}
                          </div>
                          <div
                            className={cn(
                              "truncate text-[11px] font-medium",
                              isCurrent || (c.status === "paid" && i === 3)
                                ? "text-slate-900"
                                : done
                                  ? "text-slate-500"
                                  : "text-slate-400",
                            )}
                          >
                            {label}
                          </div>
                          {i < 3 ? (
                            <div
                              className={cn(
                                "h-px flex-1",
                                done ? "bg-emerald-500" : "bg-slate-200",
                              )}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {c.status === "more_info_needed" ? (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                      <Clock size={14} className="mt-0.5 shrink-0" />
                      The insurer needs more information — reply in the conversation below.
                    </div>
                  ) : null}
                </section>
              ) : (
                <section className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-rose-900">Claim rejected</div>
                    <div className="mt-0.5 text-sm text-rose-800">
                      {c.insurerRemarks ?? "The insurer declined this claim. You can reply below or file a new claim."}
                    </div>
                  </div>
                </section>
              )}

              <section className={PANEL}>
                <PanelHeader
                  icon={<Stethoscope size={16} />}
                  tone="bg-violet-50 text-violet-600"
                  title="Treatment details"
                  caption="Clinical and facility information."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoField icon={<Hospital size={14} />} label="Facility">
                    {c.incurringFacility ?? "—"}
                  </InfoField>
                  <InfoField icon={<Calendar size={14} />} label="Admission">
                    {c.admissionDate ? formatDate(c.admissionDate) : "—"}
                  </InfoField>
                  <InfoField icon={<Calendar size={14} />} label="Discharge">
                    {c.dischargeDate ? formatDate(c.dischargeDate) : "—"}
                  </InfoField>
                  <InfoField icon={<FileText size={14} />} label="Diagnosis">
                    {c.diagnosis ?? "—"}
                  </InfoField>
                </div>
                {c.patientRemarks ? (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <div className={GROUP_LABEL}>Your remarks</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                      {c.patientRemarks}
                    </p>
                  </div>
                ) : null}
              </section>

              {c.documents && c.documents.length > 0 ? (
                <section className={PANEL}>
                  <PanelHeader
                    icon={<FileText size={16} />}
                    tone="bg-sky-50 text-sky-600"
                    title={`Documents (${c.documents.length})`}
                    caption="Files submitted with this claim."
                  />
                  <ul className="mt-4 space-y-1.5">
                    {c.documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                          <FileText size={14} />
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                          {d.fileName ?? d.kind}
                        </span>
                        <Badge tone="slate">{d.kind.replace(/_/g, " ")}</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className={PANEL}>
                <PanelHeader
                  icon={<MessageCircle size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Conversation"
                  caption="Messages between you and the insurer."
                />
                {c.messages && c.messages.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {c.messages.map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          "rounded-xl border-l-2 px-3.5 py-2.5 text-sm",
                          m.senderRole === "patient"
                            ? "ml-8 border-sky-500 bg-sky-50/60"
                            : "mr-8 border-slate-300 bg-slate-50",
                        )}
                      >
                        <div className="text-[11px] font-semibold text-slate-400">
                          {m.senderRole === "patient" ? "You" : "Insurer"} ·{" "}
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                        <div className="mt-0.5 text-slate-800">{m.body}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm italic text-slate-400">
                    No messages yet. Send the first reply.
                  </p>
                )}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your message…"
                    rows={3}
                    className={FIELD_TEXTAREA}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => replyMut.mutate()}
                      disabled={!reply.trim() || replyMut.isPending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                    >
                      <Send size={14} /> {replyMut.isPending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-5 xl:col-span-4">
              <section className={PANEL}>
                <PanelHeader
                  icon={<Building2 size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Insurer remarks"
                  caption="Assessment notes."
                />
                {c.insurerRemarks ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{c.insurerRemarks}</p>
                ) : (
                  <p className="mt-4 text-sm italic text-slate-400">
                    No remarks from the insurer yet.
                  </p>
                )}
              </section>

              <QuickToolsPanel
                id="claim-tools"
                title="Insurance"
                tools={[
                  {
                    icon: ShieldCheck,
                    label: "My policy",
                    hint: "Coverage",
                    href: `/patient/insurance/policy/${c.enrollmentId}`,
                    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  },
                  {
                    icon: CreditCard,
                    label: "E-card",
                    hint: "Cashless pass",
                    href: `/patient/insurance/ecard/${c.enrollmentId}`,
                    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                  },
                  {
                    icon: Receipt,
                    label: "All claims",
                    hint: "History",
                    href: "/patient/insurance/claims",
                    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
                  },
                ]}
              />
            </aside>
          </div>
        </>
      )}
    </PatientPage>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved" || status === "paid")
    return <CheckCircle2 size={12} className="text-emerald-300" />;
  if (status === "rejected")
    return <AlertTriangle size={12} />;
  return <Clock size={12} className="text-amber-300" />;
}
