"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/hospital/i18n";
import { cn } from "@/portal/lib/utils";

const TABS = [
  { href: "/hospital/collab/requests", labelKey: "collab.tabs.requests" },
  { href: "/hospital/collab/referrals", labelKey: "collab.tabs.referrals" },
  { href: "/hospital/collab/lab-routing", labelKey: "collab.tabs.lab" },
  { href: "/hospital/collab/consults", labelKey: "collab.tabs.consults" },
  { href: "/hospital/collab/discharges", labelKey: "collab.tabs.discharges" },
] as const;

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      <nav
        className="flex flex-wrap items-center gap-1 border-b border-border/60"
        aria-label="Collaboration sections"
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-brand text-text"
                  : "border-transparent text-text-muted hover:text-text"
              )}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
