"use client";

import { use } from "react";

import { useRouter } from "next/navigation";

import { RecordForm } from "@/patient/components/records/RecordForm";
import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useDeleteRecord, useRecord } from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";

export default function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useRecord(id);
  const del = useDeleteRecord();

  function onDelete() {
    if (!window.confirm("Delete this record permanently?")) return;
    del
      .mutateAsync(id)
      .then(() => {
        toast.success("Record deleted");
        router.push("/patient/records");
      })
      .catch((e) =>
        toast.error("Could not delete", e instanceof Error ? e.message : undefined),
      );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader
        label="Your file"
        title="Edit record"
        description="Update the metadata or delete the record entirely."
      />
      <Card>
        <QueryBoundary
          query={query}
          loadingCount={2}
          emptyTitle="No such record"
        >
          {(data) => {
            const tags = data.tags
              ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];
            return (
              <div className="flex flex-col gap-6">
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
                <hr className="border-border" />
                <button
                  type="button"
                  onClick={onDelete}
                  className="self-start rounded-inner border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                  disabled={del.isPending}
                >
                  Delete this record
                </button>
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}