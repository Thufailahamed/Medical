"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FilePlus2, Paperclip, Scan, ShieldCheck, Sparkles, Users } from "lucide-react";

import { RecordForm } from "@/patient/components/records/RecordForm";
import {
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroTile,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  RailRow,
} from "@/patient/components/workspace";

const TIPS = [
  { title: "Attach the original", body: "Add PDFs or photos after saving", tone: "violet" as const, icon: <Paperclip size={16} /> },
  { title: "Auto-extraction", body: "Lab values are read from attachments", tone: "sky" as const, icon: <Sparkles size={16} /> },
  { title: "Family records", body: "Move it to a family member any time", tone: "emerald" as const, icon: <Users size={16} /> },
];

export default function NewRecordPage() {
  const router = useRouter();

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <HeroTile>
            <FilePlus2 size={30} aria-hidden />
          </HeroTile>
        }
        kickerIcon={<FilePlus2 size={13} aria-hidden />}
        kicker="Medical records"
        kickerMeta="New entry"
        title="New medical record"
        description="Log a lab report, visit note, prescription or procedure. You can attach scans and files right after it's created."
        chips={
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
            Stored encrypted
          </span>
        }
        actions={
          <>
            <Link href="/patient/records" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All records
            </Link>
            <Link href="/patient/records/scan" className={HERO_PRIMARY}>
              <Scan size={15} className="text-sky-600" aria-hidden />
              Scan instead
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={PANEL + " min-w-0 xl:col-span-8"} aria-labelledby="nr-form">
          <PanelHeader
            id="nr-form"
            icon={<FilePlus2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Record details"
            caption="Pick a type, then fill in what you know"
          />
          <div className="mt-5">
            <RecordForm mode="create" onSuccess={(id) => router.push(`/patient/records/${id}`)} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Tips">
          <section className={PANEL} aria-labelledby="nr-tips">
            <PanelHeader id="nr-tips" icon={<Sparkles size={16} />} tone="bg-violet-50 text-violet-600" title="Good to know" />
            <ul className="mt-4 flex flex-col gap-2">
              {TIPS.map((t) => (
                <li key={t.title}>
                  <RailRow tone={t.tone} icon={t.icon} title={t.title} meta={t.body} />
                </li>
              ))}
            </ul>
          </section>
          <PromoCard
            href="/patient/records/scan"
            kicker="Faster"
            icon={<Scan size={21} aria-hidden />}
            title="Have a paper copy?"
            body="Scan it and we'll fill the form for you"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
