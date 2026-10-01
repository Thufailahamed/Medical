"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  HeartHandshake,
  Inbox,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  Store,
  Undo2,
  Users,
  XCircle,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HERO_ATTENTION_CHIP,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
  TONE_RAIL,
  TONE_TILE,
  type Tone,
} from "@/patient/components/workspace";
import {
  useCaretakerInquiries,
  useWithdrawCaretakerInquiry,
} from "@/patient/hooks/marketplace";
import { formatRelative, humanize } from "@/patient/lib/format";
import type { CaretakerInquiryStatus } from "@healthcare/shared/contracts";

const STATUS_TONE: Record<CaretakerInquiryStatus, Tone> = {
  pending: "amber",
  accepted: "emerald",
  declined: "rose",
  expired: "slate",
  withdrawn: "slate",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function InquiriesPage() {
  const query = useCaretakerInquiries();
  const withdraw = useWithdrawCaretakerInquiry();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onWithdraw(id: string) {
    if (!window.confirm("Withdraw this inquiry? The caretaker won't be able to accept it.")) {
      return;
    }
    setError(null);
    setWithdrawingId(id);
    try {
      await withdraw.mutateAsync(id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't withdraw the inquiry.",
      );
    } finally {
      setWithdrawingId(null);
    }
  }

  const list = query.data?.inquiries ?? [];
  const pending = list.filter((i) => i.status === "pending").length;
  const accepted = list.filter((i) => i.status === "accepted").length;
  const closed = list.filter(
    (i) => i.status === "declined" || i.status === "expired" || i.status === "withdrawn",
  ).length;

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Inbox size={13} aria-hidden />}
        kicker="Caretaker marketplace"
        kickerMeta="Sent inquiries"
        title={
          <>
            My <HeroAccent>inquiries</HeroAccent>
          </>
        }
        description="Requests you've sent to marketplace caretakers — track replies and withdraw anything still pending."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Send size={12} className="text-sky-300" aria-hidden />
              {list.length} sent
            </span>
            {pending > 0 ? (
              <span className={HERO_ATTENTION_CHIP}>
                <Clock3 size={12} aria-hidden />
                {pending} awaiting reply
              </span>
            ) : null}
            {accepted > 0 ? (
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                {accepted} accepted
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/marketplace" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Marketplace
            </Link>
            <Link href="/patient/marketplace" className={HERO_PRIMARY}>
              <Store size={14} className="text-sky-600" aria-hidden />
              Find a caretaker
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Send size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Total sent"
          value={String(list.length)}
          sub="All-time inquiries"
        />
        <StatTile
          icon={<Clock3 size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pending"
          value={String(pending)}
          sub={pending > 0 ? "Awaiting caretaker reply" : "Nothing waiting"}
          pulse={pending > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Accepted"
          value={String(accepted)}
          sub="Linked as caretakers"
          href="/patient/caretakers"
        />
        <StatTile
          icon={<XCircle size={16} />}
          tone="bg-slate-100 text-slate-500"
          label="Closed"
          value={String(closed)}
          sub="Declined, expired or withdrawn"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL} aria-labelledby="inq-list">
            <PanelHeader
              id="inq-list"
              icon={<Inbox size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={`Inquiry history (${list.length})`}
              caption="One open inquiry per caretaker — withdraw to send elsewhere."
            />
            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600"
              >
                {error}
              </div>
            ) : null}
            {query.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : query.isError ? (
              <PanelError onRetry={() => void query.refetch()} />
            ) : list.length === 0 ? (
              <EmptyBlock
                icon={<Inbox size={19} />}
                title="No inquiries yet"
                body="Find a verified caretaker in the marketplace and send your first request."
                actions={
                  <Link
                    href="/patient/marketplace"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Search size={13} aria-hidden />
                    Browse marketplace
                  </Link>
                }
              />
            ) : (
              <div className="mt-5 flex flex-col gap-2.5">
                {list.map((inq) => {
                  const tone = STATUS_TONE[inq.status] ?? "slate";
                  const isPending = inq.status === "pending";
                  return (
                    <article
                      key={inq.id}
                      className="relative flex flex-col gap-3 rounded-xl bg-white p-3.5 pl-5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.2),inset_0_0_0_1px_rgba(2,132,199,0.2)]"
                    >
                      <span
                        className={cn(
                          "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                          TONE_RAIL[tone],
                        )}
                        aria-hidden
                      />
                      <div className="flex items-center gap-3">
                        {inq.caretakerPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={inq.caretakerPhoto}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
                          />
                        ) : (
                          <span
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xs font-bold",
                              TONE_TILE[tone],
                            )}
                            aria-hidden
                          >
                            {getInitials(inq.caretakerName ?? "?")}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-900">
                              {inq.caretakerName ?? "Caretaker"}
                            </h3>
                            <Badge tone={tone}>{humanize(inq.status)}</Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Sent {formatRelative(inq.createdAt)}
                            {inq.decidedAt
                              ? ` · ${humanize(inq.status)} ${formatRelative(inq.decidedAt)}`
                              : ""}
                          </p>
                        </div>
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => void onWithdraw(inq.id)}
                            disabled={withdrawingId === inq.id}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          >
                            {withdrawingId === inq.id ? (
                              <Loader2
                                size={12}
                                className="animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Undo2 size={12} aria-hidden />
                            )}
                            Withdraw
                          </button>
                        ) : null}
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                        <p className="text-xs leading-relaxed text-slate-700">
                          {inq.patientMessage}
                        </p>
                      </div>

                      {inq.status === "accepted" && inq.linkId ? (
                        <p className="text-xs text-slate-600">
                          Accepted — this caretaker is now linked to you.{" "}
                          <Link
                            href="/patient/caretakers"
                            className="font-semibold text-sky-700 hover:underline"
                          >
                            Manage shared access
                          </Link>
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="inq-tools"
            title="Marketplace"
            tools={[
              {
                icon: Store,
                label: "Browse",
                hint: "All caretakers",
                href: "/patient/marketplace",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: HeartHandshake,
                label: "Caretakers",
                hint: "Shared access",
                href: "/patient/caretakers",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Users,
                label: "Family",
                hint: "Members",
                href: "/patient/family",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <PromoCard
            icon={<ShieldCheck size={21} aria-hidden />}
            kicker="How it works"
            title="Inquiry → link"
            body="When a caretaker accepts, they're added to your caretakers list with delegated access."
            href="/patient/caretakers"
          />
        </div>
      </div>
    </PatientPage>
  );
}
