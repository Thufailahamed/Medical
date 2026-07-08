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
  Settings as SettingsIcon,
  UserCog,
  Activity,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
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
    ],
  },
  {
    labelKey: "admin.nav.people",
    items: [
      { href: "/admin/approvals", labelKey: "admin.nav.approvals", icon: UserCheck },
      { href: "/admin/users", labelKey: "admin.nav.users", icon: Users },
      { href: "/admin/doctors", labelKey: "admin.nav.doctors", icon: Stethoscope },
      { href: "/admin/admins", labelKey: "admin.nav.admins", icon: UserCog },
    ],
  },
  {
    labelKey: "admin.nav.tenants",
    items: [
      { href: "/admin/hospitals", labelKey: "admin.nav.hospitals", icon: Hospital },
      { href: "/admin/clinics", labelKey: "admin.nav.clinics", icon: Building2 },
      { href: "/admin/pharmacies", labelKey: "admin.nav.pharmacies", icon: Pill },
      { href: "/admin/laboratories", labelKey: "admin.nav.laboratories", icon: FlaskConical },
      { href: "/admin/ambulances", labelKey: "admin.nav.ambulances", icon: Truck },
      { href: "/admin/insurances", labelKey: "admin.nav.insurances", icon: ShieldCheck },
    ],
  },
  {
    labelKey: "admin.nav.operations",
    items: [
      { href: "/admin/payouts", labelKey: "admin.nav.payouts", icon: Wallet },
      { href: "/admin/insurance-claims", labelKey: "admin.nav.insuranceClaims", icon: Receipt },
      { href: "/admin/dsar", labelKey: "admin.nav.dsar", icon: FileLock2 },
      { href: "/admin/audit", labelKey: "admin.nav.audit", icon: ScrollText },
    ],
  },
  {
    labelKey: "admin.nav.catalog",
    items: [
      { href: "/admin/medicines-master", labelKey: "admin.nav.medicinesMaster", icon: BookOpen },
      { href: "/admin/waitlist", labelKey: "admin.nav.waitlist", icon: MailCheck },
      { href: "/admin/demo-requests", labelKey: "admin.nav.demoRequests", icon: Megaphone },
    ],
  },
  {
    labelKey: "admin.nav.system",
    items: [
      { href: "/admin/system-health", labelKey: "admin.nav.systemHealth", icon: Activity },
      { href: "/admin/notifications", labelKey: "admin.nav.notifications", icon: Megaphone },
      { href: "/admin/settings", labelKey: "admin.nav.settings", icon: SettingsIcon },
    ],
  },
];