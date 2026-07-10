"use client";

import type { ReactNode } from "react";
import {
  Users,
  LayoutDashboard,
  ListOrdered,
  Calendar,
  DoorOpen,
  CalendarDays,
  Pill,
  FlaskConical,
  FileText,
  CalendarClock,
  FolderOpen,
  MessageSquare,
  Bell,
  TrendingUp,
  ClipboardList,
  HeartHandshake,
  Clock3,
  Settings,
  Building2,
  Link as LinkIcon,
} from "lucide-react";
import { useT } from "@/portal/i18n";

export interface PortalPageMeta {
  title: string;
  subtitle?: string;
  icon: ReactNode;
}

/** Route-prefix → topbar page context. Longest prefix wins. */
const ROUTE_META: Array<{
  prefix: string;
  titleKey: string;
  subtitleKey?: string;
  icon: ReactNode;
}> = [
  { prefix: "/portal/patients", titleKey: "patients.title", subtitleKey: "patients.subtitle", icon: <Users size={16} className="text-brand" /> },
  { prefix: "/portal/dashboard", titleKey: "dashboard.title", subtitleKey: "dashboard.subtitle", icon: <LayoutDashboard size={16} className="text-brand" /> },
  { prefix: "/portal/queue", titleKey: "queue.title", icon: <ListOrdered size={16} className="text-brand" /> },
  { prefix: "/portal/schedule", titleKey: "schedule.title", icon: <Calendar size={16} className="text-brand" /> },
  { prefix: "/portal/walk-ins", titleKey: "walkIns.title", icon: <DoorOpen size={16} className="text-brand" /> },
  { prefix: "/portal/appointments", titleKey: "appointments.title", icon: <CalendarDays size={16} className="text-brand" /> },
  { prefix: "/portal/prescriptions", titleKey: "prescriptions.title", icon: <Pill size={16} className="text-brand" /> },
  { prefix: "/portal/lab-orders", titleKey: "labOrders.title", icon: <FlaskConical size={16} className="text-brand" /> },
  { prefix: "/portal/clinical-notes", titleKey: "clinicalNotes.title", icon: <FileText size={16} className="text-brand" /> },
  { prefix: "/portal/follow-ups", titleKey: "followUps.title", icon: <CalendarClock size={16} className="text-brand" /> },
  { prefix: "/portal/records", titleKey: "records.title", icon: <FolderOpen size={16} className="text-brand" /> },
  { prefix: "/portal/messages", titleKey: "messages.title", icon: <MessageSquare size={16} className="text-brand" /> },
  { prefix: "/portal/notifications", titleKey: "notifications.title", icon: <Bell size={16} className="text-brand" /> },
  { prefix: "/portal/earnings", titleKey: "earnings.title", icon: <TrendingUp size={16} className="text-brand" /> },
  { prefix: "/portal/rx-templates", titleKey: "rxTemplates.title", icon: <ClipboardList size={16} className="text-brand" /> },
  { prefix: "/portal/care-team", titleKey: "careTeam.title", icon: <HeartHandshake size={16} className="text-brand" /> },
  { prefix: "/portal/availability", titleKey: "availability.title", icon: <Clock3 size={16} className="text-brand" /> },
  { prefix: "/portal/pharmacy", titleKey: "pharmacy.title", icon: <Pill size={16} className="text-brand" /> },
  { prefix: "/portal/settings", titleKey: "settings.title", icon: <Settings size={16} className="text-brand" /> },
  { prefix: "/portal/clinics", titleKey: "clinics.title", icon: <Building2 size={16} className="text-brand" /> },
  { prefix: "/portal/relationships", titleKey: "relationships.title", icon: <LinkIcon size={16} className="text-brand" /> },
];

export function usePortalPageMeta(pathname: string): PortalPageMeta | null {
  const t = useT();
  const match = [...ROUTE_META]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!match) return null;
  return {
    title: t(match.titleKey),
    subtitle: match.subtitleKey ? t(match.subtitleKey) : undefined,
    icon: match.icon,
  };
}

/** True when the page title is rendered in the topbar (skip in-page PageHeader). */
export function topbarShowsPageTitle(pathname: string): boolean {
  return pathname === "/portal/patients";
}
