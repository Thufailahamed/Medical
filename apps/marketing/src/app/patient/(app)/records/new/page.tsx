"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FileCheck,
  FilePlus,
  Scan,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { RecordForm } from "@/patient/components/records/RecordForm";

export default function NewRecordPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<FilePlus size={13} />}
        kicker="Electronic Health Record (EHR)"
        title="New Medical Record"
        description="Manually record a diagnostic report, doctor note, clinical prescription, or surgery. You can attach digital scans and files directly after creating it."
        actions={
          <>
            <Link href="/patient/records" className={heroSecondaryAction}>
              <ChevronLeft size={13} />
              <span>Back to Records</span>
            </Link>
            <Link href="/patient/records/scan" className={heroPrimaryAction}>
              <Scan size={14} />
              <span>Scan Paper Copy</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>18 record categories</span>
            <span>Encryption · AES-256 vault</span>
            <span>Family scope · member synced</span>
            <span>AI integration · auto-parsed</span>
          </>
        }
      />

      {/* ── 2. Record Form Card Container ──────────────────────────────────── */}
      <section className="patient-card p-5 sm:p-7">
        <RecordForm
          mode="create"
          onSuccess={(id) => router.push(`/patient/records/${id}`)}
        />
      </section>
    </div>
  );
}