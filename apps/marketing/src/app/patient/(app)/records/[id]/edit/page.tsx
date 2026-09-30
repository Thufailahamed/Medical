"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, FileSearch, Pencil, Trash2 } from "lucide-react";

import { RecordForm } from "@/patient/components/records/RecordForm";
import { RecordTypeIcon, recordGradient } from "@/patient/components/records/recordType";
import { useDeleteRecord, useRecord } from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import {
  EmptyBlock,
  HERO_GHOST,
  HeroTile,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

export default function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useRecord(id);
  const del = useDeleteRecord();
  const data = query.data;

  function onDelete() {
    if (!window.confirm("Delete this record permanently?")) return;
    del
      .mutateAsync(id)
      .then(() => {
        toast.success("Record deleted");
        router.push("/patient/records");
      })
      .catch((e) => toast.error("Could not delete", e instanceof Error ? e.message : undefined));
  }

  const tags = data?.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <HeroTile tone={recordGradient(data?.recordType)}>
            <RecordTypeIcon type={data?.recordType} size={30} />
          </HeroTile>
        }
        kickerIcon={<Pencil size={13} aria-hidden />}
        kicker="Edit record"
        kickerMeta={data ? formatRecordType(data.recordType) : undefined}
        title={data?.title ?? (query.isLoading ? "Loading record…" : "Record not found")}
        description={
          data
            ? `Filed ${formatDayLabel(data.date)}. Update the details below or remove the record entirely.`
            : "Update the metadata or delete the record entirely."
        }
        actions={
          <Link href={`/patient/records/${id}`} className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            Back to record
          </Link>
        }
      />

      {!data ? (
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock className="mt-0" icon={<FileSearch size={19} />} title="No such record" body="It may have been deleted." />
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <section className={PANEL + " min-w-0 xl:col-span-8"} aria-labelledby="er-form">
            <PanelHeader
              id="er-form"
              icon={<Pencil size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Record details"
              caption="Changes are saved to your file immediately"
            />
            <div className="mt-5">
              <RecordForm
                mode="edit"
                recordId={id}
                initial={{
                  kind: data.recordType,
                  title: data.title,
                  date: data.date.slice(0, 10),
                  diagnosis: data.diagnosis ?? undefined,
                  summary: data.summary ?? undefined,
                  tags,
                }}
                onSuccess={() => router.push(`/patient/records/${id}`)}
              />
            </div>
          </section>

          <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Danger zone">
            <section className={PANEL} aria-labelledby="er-danger">
              <PanelHeader
                id="er-danger"
                icon={<AlertTriangle size={16} />}
                tone="bg-rose-50 text-rose-600"
                title="Danger zone"
                caption="This cannot be undone"
              />
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Deleting removes the record and every attachment from your file. Doctors you shared it with lose access too.
              </p>
              <button
                type="button"
                onClick={onDelete}
                disabled={del.isPending}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 size={13} aria-hidden />
                Delete this record
              </button>
            </section>
          </aside>
        </div>
      )}
    </PatientPage>
  );
}
