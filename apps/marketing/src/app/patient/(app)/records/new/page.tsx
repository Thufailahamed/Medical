"use client";

import { useRouter } from "next/navigation";

import { RecordForm } from "@/patient/components/records/RecordForm";
import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";

export default function NewRecordPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader
        label="Your file"
        title="New medical record"
        description="Capture a record from your file. You can attach files after creating it."
      />
      <Card>
        <RecordForm
          mode="create"
          onSuccess={(id) => router.push(`/patient/records/${id}`)}
        />
      </Card>
    </div>
  );
}