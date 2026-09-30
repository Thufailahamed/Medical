"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Clock3,
  FileSearch,
  FileText,
  FolderOpen,
  Share2,
  Stethoscope,
  Tag,
} from "lucide-react";

import {
  RecordActionsBar,
  RecordAttachmentsSection,
  StructuredChildren,
} from "@/patient/components/records";
import { RecordTypeIcon, recordGradient, recordTone } from "@/patient/components/records/recordType";
import { useRecord, useRecordAttachments } from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import {
  Badge,
  EmptyBlock,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroTile,
  InfoField,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  TONE_TILE,
} from "@/patient/components/workspace";

const STRUCTURED_KINDS = new Set(["lab_report", "imaging", "discharge_summary", "vaccination", "prescription"]);

const STRUCTURED_TITLE: Record<string, string> = {
  lab_report: "Lab results",
  imaging: "Imaging findings",
  discharge_summary: "Discharge events",
  vaccination: "Vaccine doses",
  prescription: "Prescribed medicines",
};

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useRecord(id);
  const attachments = useRecordAttachments(id);
  const files = attachments.data?.files ?? [];
  const data = query.data;

  if (!data) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<FolderOpen size={13} aria-hidden />}
          kicker="Medical record"
          title={query.isLoading ? "Loading record…" : "Record not found"}
          description={
            query.isLoading ? "Fetching this document from your file." : "We couldn't find that record on your file."
          }
          actions={
            <Link href="/patient/records" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All records
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock
              className="mt-0"
              icon={<FileSearch size={19} />}
              title="No such record"
              body="It may have been deleted or moved to a family member."
            />
          )}
        </section>
      </PatientPage>
    );
  }

  const kind = (data.recordType ?? "").toLowerCase();
  const tone = recordTone(kind);
  const archived = Boolean((data as { archivedAt?: string | null }).archivedAt);
  const tags = data.tags
    ? data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const status = data.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : "Filed";

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <HeroTile tone={recordGradient(kind)}>
            <RecordTypeIcon type={kind} size={30} />
          </HeroTile>
        }
        kickerIcon={<FolderOpen size={13} aria-hidden />}
        kicker={formatRecordType(data.recordType)}
        kickerMeta={formatDayLabel(data.date)}
        title={data.title}
        description={data.diagnosis ?? "A document from your medical file — attach the original and share it when you need to."}
        chips={
          <>
            <span className={HERO_CHIP}>
              <CircleCheck size={12} className="text-emerald-300" aria-hidden />
              {status}
            </span>
            {archived ? (
              <span className={HERO_CHIP}>
                <Archive size={12} className="text-amber-300" aria-hidden />
                Archived
              </span>
            ) : null}
            <span className={HERO_CHIP}>
              <FileText size={12} className="text-sky-300" aria-hidden />
              {files.length} attachment{files.length === 1 ? "" : "s"}
            </span>
            {tags.slice(0, 3).map((t) => (
              <span key={t} className={HERO_CHIP}>
                <Tag size={12} className="text-sky-300" aria-hidden />
                {t}
              </span>
            ))}
          </>
        }
        actions={
          <>
            <Link href="/patient/records" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All records
            </Link>
            <Link href="/patient/share" className={HERO_PRIMARY}>
              <Share2 size={15} className="text-sky-600" aria-hidden />
              Share
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="rd-overview">
            <PanelHeader
              id="rd-overview"
              icon={<RecordTypeIcon type={kind} />}
              tone={TONE_TILE[tone]}
              title="Record overview"
              caption="Details captured when this record was filed"
            />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<FolderOpen size={14} />} label="Type">
                {formatRecordType(data.recordType)}
              </InfoField>
              <InfoField icon={<CalendarDays size={14} />} label="Date">
                {formatDayLabel(data.date)}
              </InfoField>
              <InfoField icon={<Stethoscope size={14} />} label="Diagnosis">
                {data.diagnosis ?? "—"}
              </InfoField>
              <InfoField icon={<Clock3 size={14} />} label="Added to your file">
                {data.createdAt ? formatDayLabel(data.createdAt) : "—"}
              </InfoField>
            </dl>

            {data.summary ? (
              <div className="mt-5">
                <p className={GROUP_LABEL}>Summary</p>
                <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  {data.summary}
                </p>
              </div>
            ) : null}

            {tags.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className={GROUP_LABEL + " mr-1"}>Tags</span>
                {tags.map((t) => (
                  <Badge key={t} tone="sky">
                    #{t}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="mt-5 border-t border-slate-100 pt-5">
              <RecordActionsBar
                recordId={id}
                archived={archived}
                hasAttachments={files.length > 0}
                onEdit={() => router.push(`/patient/records/${id}/edit`)}
                onDeleteSuccess={() => router.push("/patient/records")}
              />
            </div>
          </section>

          {STRUCTURED_KINDS.has(kind) ? (
            <section className={PANEL} aria-labelledby="rd-structured">
              <PanelHeader
                id="rd-structured"
                icon={<FileSearch size={16} />}
                tone="bg-teal-50 text-teal-600"
                title={STRUCTURED_TITLE[kind] ?? "Extracted data"}
                caption="Read automatically from your attached report"
              />
              <div className="mt-5">
                <StructuredChildren recordId={id} kind={kind} />
              </div>
            </section>
          ) : null}

          <div className={PANEL}>
            <RecordAttachmentsSection recordId={id} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Record tools">
          <QuickToolsPanel
            id="rd-tools"
            tools={[
              { href: `/patient/records/${id}/edit`, label: "Edit", hint: "Update details", icon: FileText, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/timeline", label: "Timeline", hint: "In context", icon: Clock3, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
              { href: "/patient/share", label: "Share", hint: "With a doctor", icon: Share2, tone: "from-rose-500 to-pink-600 shadow-rose-500/30" },
            ]}
          />
          <PromoCard
            href="/patient/ai"
            kicker="AI assistant"
            icon={<FileSearch size={21} aria-hidden />}
            title="Understand this report"
            body="Ask questions in plain language"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
