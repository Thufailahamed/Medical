"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-nav";
import { useT } from "@/portal/i18n";

function flatten(items: { href: string; labelKey: string }[]) {
  return items.map((i) => i);
}

export function AdminTopbar() {
  const pathname = usePathname() || "";
  const t = useT();

  // Resolve current page label for the breadcrumb-style title.
  const all = ADMIN_NAV_GROUPS.flatMap((g) => flatten(g.items));
  const current = all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const currentLabel = current
    ? (() => {
        const translated = t(current.labelKey);
        return translated === current.labelKey ? current.labelKey.split(".").pop() : translated;
      })()
    : "";

  return (
    <header className="h-[60px] bg-surface border-b border-border flex items-center px-6 gap-3">
      <div className="flex items-center gap-1.5 text-text-soft text-sm">
        <span className="font-semibold text-text">Admin</span>
        <ChevronRight size={14} className="text-text-muted" />
        <span>{currentLabel}</span>
      </div>
      <div className="flex-1" />
      <a
        href="/portal/dashboard"
        className="text-xs text-text-soft hover:text-text underline-offset-2 hover:underline"
      >
        ← Doctor portal
      </a>
    </header>
  );
}