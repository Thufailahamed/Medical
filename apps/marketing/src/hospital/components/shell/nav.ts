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
} from "lucide-react";

import type { HospitalRole } from "@/hospital/stores/auth";

export type PortalRole = HospitalRole;

export interface NavItem {
  href: string;
  /** Translation key under nav.* in the i18n dict. */
  labelKey: string;
  icon: any;
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
      { href: "/hospital/departments", labelKey: "departments", icon: Building2, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/settings", labelKey: "settings", icon: Settings, roles: ["hospital_admin", "super_admin"] },
      { href: "/hospital/notifications", labelKey: "notifications", icon: Bell },
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