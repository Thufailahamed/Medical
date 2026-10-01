import {
  ClipboardList,
  LayoutDashboard,
  PackageOpen,
  TestTube2,
  Users,
} from "lucide-react";

export type LabNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export type LabNavGroup = {
  label: string;
  items: LabNavItem[];
};

export const LAB_NAV_GROUPS: LabNavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/lab-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lab-portal/bookings", label: "Bookings", icon: ClipboardList },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/lab-portal/catalog", label: "Test Catalog", icon: TestTube2 },
      { href: "/lab-portal/packages", label: "Packages", icon: PackageOpen },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/lab-portal/phlebotomists", label: "Phlebotomists", icon: Users },
    ],
  },
];

/**
 * Longest-prefix match so detail routes resolve to their parent item,
 * e.g. /lab-portal/bookings/abc → Bookings with isDetail = true.
 */
export function findNavItem(pathname: string):
  | { group: LabNavGroup; item: LabNavItem; isDetail: boolean }
  | null {
  let best: { group: LabNavGroup; item: LabNavItem } | null = null;
  for (const group of LAB_NAV_GROUPS) {
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
