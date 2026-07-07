"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";

/**
 * Read-only system info. Operational toggles (rate limits, feature
 * flags) live in the Cloudflare dashboard — settings here is the
 * single landing page that links out, plus a few values surfaced
 * for visibility.
 */
export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title="System settings"
        subtitle="Operational configuration. Mutating controls are managed via Cloudflare dashboard + env vars."
        icon={<SettingsIcon size={20} className="text-amber-600" />}
      />

      <section className="bg-surface border border-border rounded-2xl p-5">
        <SectionHeader title="Build & runtime" />
        <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <Info label="API base" value={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"} />
          <Info label="Locale" value={process.env.NEXT_PUBLIC_LOCALE ?? "en"} />
          <Info label="Admin portal version" value="0.1.0 (Phase ADM-1)" />
          <Info label="Migration" value="0017_admin_approval" />
        </dl>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-5">
        <SectionHeader title="Approval policy" />
        <ul className="mt-3 text-sm space-y-2 text-text-soft list-disc pl-5">
          <li>Doctors, hospital admins, pharmacies, laboratories, insurance and ambulance providers must be approved by a super_admin before login.</li>
          <li>Patients self-register and are active immediately.</li>
          <li>Hospital staff join via invite tokens consumed at registration time.</li>
          <li>super_admin accounts are bootstrapped out-of-band and cannot be self-registered.</li>
        </ul>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-5">
        <SectionHeader title="Operational links" />
        <ul className="mt-3 text-sm space-y-2">
          <li>
            <a href="https://dash.cloudflare.com" target="_blank" rel="noopener" className="text-amber-700 hover:underline">
              Cloudflare dashboard (workers, D1, R2) ↗
            </a>
          </li>
          <li>
            <a href="https://api.healthhub.app/admin/dashboard" target="_blank" rel="noopener" className="text-amber-700 hover:underline">
              Raw API admin surface ↗
            </a>
          </li>
          <li>
            <a href="https://github.com/healthcare/platform" target="_blank" rel="noopener" className="text-amber-700 hover:underline">
              Repository ↗
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">{label}</dt>
      <dd className="mt-1 font-mono text-xs">{value}</dd>
    </div>
  );
}