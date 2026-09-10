"use client";

import {
  CareAssistant,
  DashboardHero,
  HealthSummaryStrip,
  InsuranceCoverage,
  MedicationsToday,
  NotificationsPreview,
  QuickActions,
  RecentRecords,
  SafetyBanner,
  UpcomingAppointment,
  VitalsTrend,
} from "@/patient/components/dashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 pt-1">
      <DashboardHero />
      <SafetyBanner />
      <QuickActions />
      <HealthSummaryStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><MedicationsToday /></div>
        <div className="lg:col-span-5"><UpcomingAppointment /></div>
      </div>

      <VitalsTrend />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex"><RecentRecords className="w-full" /></div>
        <div className="lg:col-span-5 flex"><NotificationsPreview className="w-full" /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 flex"><InsuranceCoverage className="w-full" /></div>
        <div className="lg:col-span-7 flex"><CareAssistant className="w-full" /></div>
      </div>
    </div>
  );
}
