/**
 * Hospital + clinic sidebar navigation tree.
 *
 * Groups are coarse role filters (e.g. `hiddenFrom: ["pharmacy"]` drops
 * the whole group). Items can carry a finer `roles` allow-list.
 *
 * Roles accepted on the hospital portal:
 *   - hospital_admin  → full surface
 *   - hospital_staff  → reception + IPD + lab (read-only) + reports (read)
 *   - pharmacy        → pharmacy queue + inventory only
 *   - laboratory      → lab orders only
 *   - super_admin     → full surface (cross-tenant)
 */

import {
  LayoutDashboard,
  Users,
  DoorOpen,
  CalendarDays,
  BedDouble,
  Hospital,
  Pill,
  FlaskConical,
  FileText,
  Receipt,
  TrendingUp,
  UserCog,
  Mail,
  Building2,
  Settings,
  Bell,
  Share2,
  Server,
} from "lucide-react";

import type { HospitalRole } from "@/hospital/stores/auth";

export type PortalRole = HospitalRole;

export interface NavItem {
  href: string;
  /** Translation key under nav.* in the i18n dict. */
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Roles that may see this item. Omit = visible to every portal role. */
  roles?: PortalRole[];
}

export interface NavGroup {
  /** Translation key under nav.* for the group label. */
  labelKey: string;
  /** Whole-group filter — when the user's role is in this list, hide. */
  hiddenFrom?: PortalRole[];
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "reception",
    hiddenFrom: ["pharmacy", "laboratory"],
    items: [
      { href: "/hospital/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
      { href: "/hospital/reception/patients", labelKey: "patients", icon: Users },
      { href: "/hospital/reception/walk-ins", labelKey: "walkIns", icon: DoorOpen },
      { href: "/hospital/reception/appointments", labelKey: "appointments", icon: CalendarDays },
    ],
  },
  {
    labelKey: "inpatient",
    hiddenFrom: ["pharmacy", "laboratory"],
    items: [
      { href: "/hospital/ipd", labelKey: "ipd", icon: BedDouble },
      { href: "/hospital/wards", labelKey: "wards", icon: Hospital },
      { href: "/hospital/beds", labelKey: "beds", icon: BedDouble },
    ],
  },
  {
    labelKey: "pharmacy",
    hiddenFrom: ["laboratory", "hospital_staff"],
    items: [
      { href: "/hospital/pharmacy", labelKey: "pharmacyQueue", icon: Pill },
    ],
  },
  {
    labelKey: "lab",
    hiddenFrom: ["pharmacy", "hospital_staff"],
    items: [
      { href: "/hospital/lab", labelKey: "labOrders", icon: FlaskConical },
    ],
  },
  {
    labelKey: "reports",
    hiddenFrom: ["pharmacy", "laboratory"],
    items: [
      { href: "/hospital/billing", labelKey: "billing", icon: Receipt },
      { href: "/hospital/billing/outstanding", labelKey: "billingOutstanding", icon: FileText },
      { href: "/hospital/reports", labelKey: "reportsOverview", icon: TrendingUp },
    ],
  },
  {
    labelKey: "admin",
    hiddenFrom: ["pharmacy", "laboratory", "hospital_staff"],
    items: [
      { href: "/hospital/staff", labelKey: "staff", icon: UserCog, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/staff/invites", labelKey: "staffInvites", icon: Mail, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/staff/departments", labelKey: "departments", icon: Building2, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/settings", labelKey: "settings", icon: Settings, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/settings/pacs", labelKey: "pacsIntegrations", icon: Server, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/notifications", labelKey: "notifications", icon: Bell },
    ],
  },
  {
    labelKey: "collab",
    hiddenFrom: ["pharmacy", "laboratory"],
    items: [
      { href: "/hospital/collab/requests", labelKey: "collab", icon: Share2 },
    ],
  },
];

/**
 * Filter the global NAV_GROUPS for the active role. Items without a
 * `roles` array default to visible. Groups drop entirely when the role
 * is in `hiddenFrom`.
 */
export function visibleNavGroups(role: PortalRole | undefined): NavGroup[] {
  return NAV_GROUPS
    .filter((g) => !(g.hiddenFrom ?? []).includes(role as PortalRole))
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.roles || i.roles.includes(role as PortalRole)
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Resolve a nav label key (`nav.foo` or a leaf key like `staffInvites`),
 * falling back to a humanised key when the translation is missing.
 */
export function navLabel(t: (k: string) => string, key: string): string {
  const fullKey = `nav.${key}`;
  const direct = t(fullKey);
  if (direct && direct !== fullKey) return direct;
  return (key.split(".").pop() ?? key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * Find the nav item (and its group) for a pathname. Uses the longest
 * matching href so nested routes like `/hospital/billing/outstanding`
 * resolve to their own item before `/hospital/billing`. Collab subpages
 * (`/hospital/collab/*`) resolve to the requests item — the collab group
 * exposes a single nav entry over five routes.
 */
export function findNavItem(pathname: string) {
  let best: { group: NavGroup; item: NavItem; href: string } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.href.length) {
          best = { group, item, href: item.href };
        }
      }
    }
  }
  if (!best && pathname.startsWith("/hospital/collab")) {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.href === "/hospital/collab/requests") {
          best = { group, item, href: item.href };
        }
      }
    }
  }
  if (!best) return null;
  return { group: best.group, item: best.item, isDetail: pathname !== best.href };
}