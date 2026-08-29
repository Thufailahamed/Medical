"use client";

import Link from "next/link";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";

const FEATURES = [
  ["Family", "/patient/family", "Switch and manage family health profiles."],
  ["Caretakers", "/patient/caretakers", "Manage delegated care access."],
  ["Care team", "/patient/care-team", "Review doctors connected to your care."],
  ["AI health tools", "/patient/ai", "Use supported summaries and explanations."],
  ["Insurance", "/patient/insurance", "Policies, plans, claims, and e-cards."],
  ["Diagnostic tests", "/patient/diagnostic-tests", "Browse tests and bookings."],
  ["Imaging", "/patient/imaging", "Review imaging studies securely."],
  ["Share access", "/patient/share", "Create and revoke share links."],
  ["Export data", "/patient/export", "Download your health data."],
  ["Audit activity", "/patient/audit", "See access to your records."],
  ["Emergency", "/patient/emergency", "Keep emergency access ready."],
  ["Health ID", "/patient/health-id", "Issue a temporary care identity."],
] as const;

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Patient tools" title="More features" description="Everything available across your health app, in one place." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, href, description]) => (
          <Link key={href} href={href} className="block">
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-float">
              <h2 className="text-sm font-bold text-text">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-soft">{description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
