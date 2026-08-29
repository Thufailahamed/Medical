"use client";

import {
  CareAssistant,
  DashboardHero,
  MedicationsToday,
  QuickActions,
  RecentRecords,
  SafetyBanner,
  UpcomingAppointment,
  VitalsTrend,
} from "@/patient/components/dashboard";

/**
 * Patient home — only what you need today:
 * greeting, safety, shortcuts, meds + next visit, vitals, records, AI.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5 px-1 pb-6 pt-1 sm:gap-6 sm:px-2">
      <DashboardHero />
      <SafetyBanner />
      <QuickActions />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MedicationsToday />
        <UpcomingAppointment />
      </div>

      <VitalsTrend />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentRecords />
        <CareAssistant className="min-h-full" />
      </div>
    </div>
  );
}
