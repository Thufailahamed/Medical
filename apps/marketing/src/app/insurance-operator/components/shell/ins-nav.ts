import {
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

export type InsNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export type InsNavGroup = {
  label: string;
  items: InsNavItem[];
};

export const INS_NAV_GROUPS: InsNavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/insurance-operator/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/insurance-operator/claims", label: "Claims Queue", icon: ClipboardCheck },
      { href: "/insurance-operator/enrollments", label: "Enrollments", icon: ShieldCheck },
    ],
  },
];

/**
 * Longest-prefix match so detail routes resolve to their parent item,
 * e.g. /insurance-operator/claims/abc → Claims Queue with isDetail = true.
 */
export function findNavItem(pathname: string):
  | { group: InsNavGroup; item: InsNavItem; isDetail: boolean }
  | null {
  let best: { group: InsNavGroup; item: InsNavItem } | null = null;
  for (const group of INS_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        if (!best || item.href.length > best.item.href.length) {
          best = { group, item };
        }
      }
    }
  }
  if (!best) return null;
  return { ...best, isDetail: pathname !== best.item.href };
}
