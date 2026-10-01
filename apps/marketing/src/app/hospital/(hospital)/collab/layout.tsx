"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  FlaskConical,
  MessageSquare,
  Share2,
  Undo2,
} from "lucide-react";
import { useT } from "@/hospital/i18n";
import { cn } from "@/portal/lib/utils";

const TABS = [
  { href: "/hospital/collab/requests", labelKey: "collab.tabs.requests", icon: FileText },
  { href: "/hospital/collab/referrals", labelKey: "collab.tabs.referrals", icon: Share2 },
  { href: "/hospital/collab/lab-routing", labelKey: "collab.tabs.lab", icon: FlaskConical },
  { href: "/hospital/collab/consults", labelKey: "collab.tabs.consults", icon: MessageSquare },
  { href: "/hospital/collab/discharges", labelKey: "collab.tabs.discharges", icon: Undo2 },
] as const;

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      <nav
        className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[color:var(--ink-border)] bg-white/80 p-1.5 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.25)] backdrop-blur"
        aria-label="Collaboration sections"
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all",
                active
                  ? "bg-[#0c1b2e] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              <Icon size={14} className={active ? "text-emerald-300" : "text-slate-400"} aria-hidden />
              {t(tab.labelKey)}
            </Link>
          );
        })}
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 pr-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:inline-flex">
          <Building2 size={12} />
          {t("nav.collab")}
        </span>
      </nav>
      {children}
    </div>
  );
}
