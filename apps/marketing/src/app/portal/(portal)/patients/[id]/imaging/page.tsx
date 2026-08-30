"use client";

import { use } from "react";
import Link from "next/link";
import { ScanLine, ExternalLink } from "lucide-react";

import { StudyList } from "@/portal/components/imaging/StudyList";
import { ChartTabHeader } from "@/portal/components/chart";

export default function ImagingTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<ScanLine size={18} />}
        title="Imaging & PACS Diagnostics"
        subtitle="Radiological imaging studies, CT/MRI series, and high-resolution DICOM web viewer"
        badge={{ count: 0, tone: "warn" }}
        actions={
          <Link
            href={`/portal/imaging?patientId=${id}`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            <ExternalLink size={14} />
            <span>Open Global PACS Viewer</span>
          </Link>
        }
      />

      <StudyList
        patientId={id}
        mode="patientChart"
        detailHrefBase="/portal/imaging"
      />
    </div>
  );
}