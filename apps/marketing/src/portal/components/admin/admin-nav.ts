"use client";

// Centralised nav config for the admin sidebar. Keys map to i18n strings
// under `admin.nav.*`. href values are absolute under /admin.

import {
  LayoutDashboard,
  UserCheck,
  Users,
  Stethoscope,
  Building2,
  Hospital,
  FlaskConical,
  Pill,
  Truck,
  ShieldCheck,
  ScrollText,
  Wallet,
  Receipt,
  FileLock2,
  Megaphone,
  BookOpen,
  MailCheck,
  Bell,
  Settings as SettingsIcon,
  UserCog,
  Activity,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /**
   * Roles allowed to see this item. Omit to allow every role the
   * admin surface accepts (super_admin, insurance, ambulance).
   * super_admin always sees everything regardless.
   */
  roles?: readonly string[];
};

export type AdminNavGroup = {
  labelKey: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    labelKey: "admin.nav.overview",
    items: [
      { href: "/admin/dashboard", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
      { href: "/admin/inbox", labelKey: "admin.nav.inbox", icon: Bell },
    ],
  },
  {
    labelKey: "admin.nav.people",
    items: [
      { href: "/admin/approvals", labelKey: "admin.nav.approvals", icon: UserCheck, roles: ["super_admin"] },
      { href: "/admin/users", labelKey: "admin.nav.users", icon: Users, roles: ["super_admin"] },
      { href: "/admin/doctors", labelKey: "admin.nav.doctors", icon: Stethoscope, roles: ["super_admin"] },
      { href: "/admin/admins", labelKey: "admin.nav.admins", icon: UserCog, roles: ["super_admin"] },
    ],
  },
  {
    labelKey: "admin.nav.tenants",
    items: [
      { href: "/admin/hospitals", labelKey: "admin.nav.hospitals", icon: Hospital, roles: ["super_admin"] },
      { href: "/admin/clinics", labelKey: "admin.nav.clinics", icon: Building2, roles: ["super_admin"] },
      { href: "/admin/pharmacies", labelKey: "admin.nav.pharmacies", icon: Pill, roles: ["super_admin"] },
      { href: "/admin/laboratories", labelKey: "admin.nav.laboratories", icon: FlaskConical, roles: ["super_admin"] },
      { href: "/admin/ambulances", labelKey: "admin.nav.ambulances", icon: Truck, roles: ["super_admin", "ambulance"] },
      { href: "/admin/insurances", labelKey: "admin.nav.insurances", icon: ShieldCheck, roles: ["super_admin", "insurance"] },
    ],
  },
  {
    labelKey: "admin.nav.operations",
    items: [
      { href: "/admin/payouts", labelKey: "admin.nav.payouts", icon: Wallet, roles: ["super_admin"] },
      { href: "/admin/insurance-claims", labelKey: "admin.nav.insuranceClaims", icon: Receipt, roles: ["super_admin", "insurance"] },
      { href: "/admin/dsar", labelKey: "admin.nav.dsar", icon: FileLock2, roles: ["super_admin"] },
      { href: "/admin/audit", labelKey: "admin.nav.audit", icon: ScrollText, roles: ["super_admin"] },
    ],
  },
  {
    labelKey: "admin.nav.catalog",
    items: [
      { href: "/admin/medicines-master", labelKey: "admin.nav.medicinesMaster", icon: BookOpen, roles: ["super_admin"] },
      { href: "/admin/waitlist", labelKey: "admin.nav.waitlist", icon: MailCheck, roles: ["super_admin"] },
      { href: "/admin/demo-requests", labelKey: "admin.nav.demoRequests", icon: Megaphone, roles: ["super_admin"] },
    ],
  },
  {
    labelKey: "admin.nav.system",
    items: [
      { href: "/admin/system-health", labelKey: "admin.nav.systemHealth", icon: Activity, roles: ["super_admin"] },
      { href: "/admin/notifications", labelKey: "admin.nav.notifications", icon: Megaphone, roles: ["super_admin"] },
      { href: "/admin/settings", labelKey: "admin.nav.settings", icon: SettingsIcon, roles: ["super_admin"] },
    ],
  },
];