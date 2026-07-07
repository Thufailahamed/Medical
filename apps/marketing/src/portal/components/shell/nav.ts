import {
  LayoutDashboard,
  Calendar,
  Users,
  CalendarDays,
  DoorOpen,
  Pill,
  FlaskConical,
  MessageSquare,
  TrendingUp,
  ClipboardList,
  HeartHandshake,
  Clock3,
  Building2,
  Settings,
  FileText,
  CalendarClock,
  FolderOpen,
  Building,
  Link,
  Bell,
  User,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  // Optional segment matcher for active state — by default active when the
  // current pathname starts with the href.
  match?: (pathname: string) => boolean;
}

export const NAV: NavItem[] = [
  { href: "/portal/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/portal/schedule", labelKey: "nav.schedule", icon: Calendar },
  { href: "/portal/patients", labelKey: "nav.patients", icon: Users },
  { href: "/portal/appointments", labelKey: "nav.appointments", icon: CalendarDays },
  { href: "/portal/walk-ins", labelKey: "nav.walkIns", icon: DoorOpen },
  { href: "/portal/prescriptions", labelKey: "nav.prescriptions", icon: Pill },
  { href: "/portal/lab-orders", labelKey: "nav.labOrders", icon: FlaskConical },
  { href: "/portal/clinical-notes", labelKey: "nav.clinicalNotes", icon: FileText },
  { href: "/portal/follow-ups", labelKey: "nav.followUps", icon: CalendarClock },
  { href: "/portal/records", labelKey: "nav.records", icon: FolderOpen },
  { href: "/portal/messages", labelKey: "nav.messages", icon: MessageSquare },
  { href: "/portal/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/portal/audit", labelKey: "nav.audit", icon: ScrollText },
  { href: "/portal/earnings", labelKey: "nav.earnings", icon: TrendingUp },
  { href: "/portal/rx-templates", labelKey: "nav.templates", icon: ClipboardList },
  { href: "/portal/care-team", labelKey: "nav.careTeam", icon: HeartHandshake },
  { href: "/portal/availability", labelKey: "nav.availability", icon: Clock3 },
  { href: "/portal/clinics", labelKey: "nav.clinics", icon: Building2 },
  { href: "/portal/tenants", labelKey: "nav.tenants", icon: Building },
  { href: "/portal/relationships", labelKey: "nav.relationships", icon: Link },
  { href: "/portal/profile", labelKey: "nav.profile", icon: User },
  { href: "/portal/settings", labelKey: "nav.settings", icon: Settings },
];