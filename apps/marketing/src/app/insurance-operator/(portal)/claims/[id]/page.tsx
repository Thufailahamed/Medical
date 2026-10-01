"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  MessageSquare,
  Send,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from "lucide-react";
import {
  useInsuranceOperatorClaim,
  useInsuranceOperatorEnrollments,
  useDecideClaim,
  usePayClaim,
  usePostClaimMessageOperator,
} from "../../../hooks/useApi";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { Badge, PanelSkeleton, type Tone } from "@/patient/components/workspace";
import { formatDate, formatDateTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

const STATUS_TONE: Record<string, Tone> = {
  submitted: "amber",
  under_review: "sky",
  more_info_needed: "violet",
  approved: "emerald",
  rejected: "rose",
  paid: "emerald",
};

const DOC_ICON: Record<string, React.ReactNode> = {
  invoice: <Banknote size={15} />,
  prescription: <Stethoscope size={15} />,
};

function statusLabel(s: string | null | undefined) {
  return (s ?? "unknown").replace(/_/g, " ");
}

const FIELD =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/10";

export default function ClaimReviewPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const router = useRouter();
  const { data, isLoading } = useInsuranceOperatorClaim(id);
  const decide = useDecideClaim();
  const payClaim = usePayClaim();
  const postMsg = usePostClaimMessageOperator();
  const enrollmentsQuery = useInsuranceOperatorEnrollments();

  const [approvedAmount, setApprovedAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reply, setReply] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const claim = data?.claim;
  // Claim rows carry enrollmentId only — resolve claimant name + policy
  // from the enrollments list (shared query cache).
  const enrollment = (enrollmentsQuery.data?.enrollments ?? []).find(
    (e) => e.id === claim?.enrollmentId,
  );
  const claimantName = enrollment?.userName || "Unknown claimant";
  const policyNumber = enrollment?.policyNumber || "—";

  const onDecide = async (decision: "approve" | "reject" | "more_info") => {
    await decide.mutateAsync({
      id,
      decision,
      amountApprovedLkr:
        decision === "approve" && approvedAmount
          ? Number(approvedAmount)
          : undefined,
      remarks: remarks || undefined,
    });
  };

  const onPay = async () => {
    if (!txnRef.trim()) return;
    await payClaim.mutateAsync({
      id,
      transactionRef: txnRef.trim(),
      amountApprovedLkr: payAmount ? Number(payAmount) : undefined,
    });
  };

  const onSend = async () => {
    if (!reply.trim()) return;
    await postMsg.mutateAsync({ id, body: reply.trim() });
    setReply("");
  };

  if (isLoading || !claim) {
    return (
      <div className="flex flex-col gap-6">
        <DoctorHero
          kicker="Claim review"
          kickerIcon={<ClipboardCheck size={12} />}
          kickerMeta={isLoading ? "Loading claim…" : "Not found"}
          title={isLoading ? "Loading claim…" : "Claim not found"}
          description={isLoading ? "Fetching the claim dossier." : "This claim may have been removed or the link is invalid."}
          overlap={false}
        />
        {!isLoading ? (
          <Link
            href="/insurance-operator/claims"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
          >
            <ArrowLeft size={13} /> Back to claims queue
          </Link>
        ) : (
          <PanelSkeleton rows={4} />
        )}
      </div>
    );
  }

  const decided = ["approved", "rejected", "paid"].includes(claim.status);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ── */}
      <DoctorHero
        kicker="Claim review"
        kickerIcon={<FileText size={12} />}
        kickerMeta={`Policy ${policyNumber}`}
        title={claimantName}
        description={`${statusLabel(claim.treatmentType)} reimbursement · filed ${
          claim.createdAt ? formatDate(claim.createdAt) : "—"
        }`}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Banknote size={12} /> LKR {(claim.amountRequestedLkr ?? 0).toLocaleString()} requested
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} /> Status · {statusLabel(claim.status)}
            </span>
            {typeof claim.amountApprovedLkr === "number" ? (
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} /> LKR {claim.amountApprovedLkr.toLocaleString()} approved
              </span>
            ) : null}
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => router.push("/insurance-operator/claims")}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/20 bg-white/[0.06] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
          >
            <ArrowLeft size={14} /> Back to queue
          </button>
        }
      />

      {/* ── Floating stat strip ── */}
      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Status"
            icon={<ShieldCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={statusLabel(claim.status)}
            sub="Current adjudication stage"
          />
          <StatTile
            label="Requested"
            icon={<Banknote size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={`LKR ${(claim.amountRequestedLkr ?? 0).toLocaleString()}`}
            sub="Claimant ask"
          />
          <StatTile
            label="Approved"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={
              typeof claim.amountApprovedLkr === "number"
                ? `LKR ${claim.amountApprovedLkr.toLocaleString()}`
                : "—"
            }
            sub="Sanctioned payout"
          />
          <StatTile
            label="Documents"
            icon={<FileText size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String((claim.documents ?? []).length)}
            sub="Supporting files"
          />
        </div>
      </HeroOverlap>

      {/* ── Review grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Claim details */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Stethoscope size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Claim dossier"
              caption="Treatment, facility and diagnosis on file"
              action={<Badge tone={STATUS_TONE[claim.status] ?? "slate"}>{statusLabel(claim.status)}</Badge>}
            />
            <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Treatment
                </dt>
                <dd className="mt-1 text-sm font-semibold capitalize text-slate-900">
                  {statusLabel(claim.treatmentType)}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Policy
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  {policyNumber}
                </dd>
              </div>
              {claim.incurringFacility ? (
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <Building2 size={11} /> Facility
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{claim.incurringFacility}</dd>
                </div>
              ) : null}
              {claim.admissionDate || claim.dischargeDate ? (
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <CalendarClock size={11} /> Admission window
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {claim.admissionDate ? formatDate(claim.admissionDate) : "—"}
                    {claim.dischargeDate ? ` → ${formatDate(claim.dischargeDate)}` : ""}
                  </dd>
                </div>
              ) : null}
              {claim.patientRemarks ? (
                <div className="rounded-xl bg-slate-50 px-4 py-3 sm:col-span-2">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Claimant note
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">{claim.patientRemarks}</dd>
                </div>
              ) : null}
              {claim.diagnosis ? (
                <div className="rounded-xl bg-slate-50 px-4 py-3 sm:col-span-2">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Diagnosis
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">{claim.diagnosis}</dd>
                </div>
              ) : null}
              {claim.insurerRemarks ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 sm:col-span-2">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-600">
                    Insurer remarks
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">{claim.insurerRemarks}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Documents */}
          <section className={PANEL}>
            <PanelHeader
              icon={<FileText size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Supporting documents"
              caption={`${(claim.documents ?? []).length} file${(claim.documents ?? []).length === 1 ? "" : "s"} attached by the claimant`}
            />
            {(claim.documents ?? []).length === 0 ? (
              <EmptyBlock
                icon={<FileText size={19} />}
                title="No documents uploaded"
                body="The claimant hasn't attached supporting files yet. Request more info if documentation is required to decide."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {(claim.documents ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-violet-50 text-violet-600">
                      {DOC_ICON[d.kind] ?? <FileText size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold capitalize text-slate-900">
                        {(d.kind ?? "document").replace(/_/g, " ")}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-slate-400">
                        {d.fileKey}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                      {formatDate(d.uploadedAt ?? d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Conversation */}
          <section className={PANEL}>
            <PanelHeader
              icon={<MessageSquare size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Conversation with claimant"
              caption="Replies are visible to the policyholder in real time"
            />
            {(claim.messages ?? []).length === 0 ? (
              <EmptyBlock
                icon={<MessageSquare size={19} />}
                title="No messages yet"
                body="Start a thread if you need clarification on treatment, billing, or documents."
              />
            ) : (
              <ul className="mt-4 flex max-h-80 flex-col gap-2.5 overflow-y-auto pr-1">
                {(claim.messages ?? []).map((m) => {
                  const ours = m.senderRole === "operator";
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                        ours
                          ? "self-end bg-sky-600 text-white shadow-[0_8px_20px_-10px_rgba(2,132,199,0.5)]"
                          : "self-start bg-slate-50 text-slate-800 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 flex items-center gap-2 text-[10.5px]",
                          ours ? "text-sky-100" : "text-slate-400",
                        )}
                      >
                        <span className="font-semibold">{ours ? "You" : claimantName}</span>
                        <span className="tabular-nums">{formatDateTime(m.createdAt)}</span>
                      </div>
                      <p className="leading-relaxed">{m.body}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to claimant…"
                aria-label="Reply to claimant"
                className={cn(FIELD, "flex-1")}
              />
              <button
                type="submit"
                disabled={!reply.trim() || postMsg.isPending}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
              >
                <Send size={13} /> Send
              </button>
            </form>
          </section>
        </div>

        {/* ── Decision aside ── */}
        <aside className="flex flex-col gap-4">
          <section className={`${PANEL} sticky top-24`}>
            <PanelHeader
              icon={<Landmark size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Adjudication"
              caption={decided ? "This claim is decided" : "Record your decision"}
            />

            {claim.status === "paid" ? (
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Banknote size={15} /> Payout settled
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {typeof claim.amountApprovedLkr === "number"
                    ? `LKR ${claim.amountApprovedLkr.toLocaleString()} paid`
                    : "Payout recorded"}
                  {claim.paidAt ? ` · ${formatDateTime(claim.paidAt)}` : ""}
                </p>
                {claim.transactionRef ? (
                  <p className="mt-2 rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                    Ref: {claim.transactionRef}
                  </p>
                ) : null}
                <Link
                  href="/insurance-operator/claims?status=submitted"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Next pending claim <ArrowRight size={12} />
                </Link>
              </div>
            ) : claim.status === "approved" ? (
              <div className="mt-5 flex flex-col gap-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-emerald-800">Approved — awaiting payout</p>
                  <p className="mt-0.5 text-slate-500">
                    Record the bank transfer reference once the settlement is sent.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Final payout · LKR
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(claim.amountApprovedLkr ?? claim.amountRequestedLkr ?? 0)}
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Defaults to the approved amount.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Transaction reference
                  </span>
                  <input
                    type="text"
                    value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                    placeholder="e.g. TXN-2024-00891"
                    className={FIELD}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void onPay()}
                  disabled={!txnRef.trim() || payClaim.isPending}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#07233a] text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
                >
                  <Banknote size={15} />
                  {payClaim.isPending ? "Recording…" : "Record payout"}
                </button>

                <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
                  The policyholder is notified with the reference number as soon as the payout is logged.
                </p>
              </div>
            ) : decided ? (
              <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3.5 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-rose-700">
                  <XCircle size={15} /> Claim rejected
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {claim.reviewedAt ? `Reviewed ${formatDateTime(claim.reviewedAt)}.` : "This claim has been adjudicated."}
                </p>
                <Link
                  href="/insurance-operator/claims?status=submitted"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  Next pending claim <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <Banknote size={11} /> Approved amount · LKR
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    placeholder={(claim.amountRequestedLkr ?? 0).toLocaleString()}
                    className={FIELD}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Leave blank to approve the full requested amount.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Remarks for claimant
                  </span>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Optional note shown to the policyholder…"
                    className={FIELD}
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void onDecide("approve")}
                    disabled={decide.isPending}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(5,150,105,0.6)] transition-all hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    {decide.isPending ? "Working…" : "Approve claim"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDecide("more_info")}
                    disabled={decide.isPending}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                  >
                    <FileText size={15} /> Request more info
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDecide("reject")}
                    disabled={decide.isPending}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle size={15} /> Reject claim
                  </button>
                </div>

                <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
                  Decisions are logged to the audit trail and notify the policyholder immediately.
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
