"use client";

import {
  BodyOverview,
  CareAssistant,
  DashboardHero,
  HealthSummaryStrip,
  InsuranceCoverage,
  MedicationsToday,
  NotificationsPreview,
  QuickActions,
  RecentActivity,
  RecentRecords,
  SafetyBanner,
  UpcomingAppointment,
  VitalsTrend,
  WeekStrip,
  WellnessScore,
} from "@/patient/components/dashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 pt-1">
      <DashboardHero />
      <SafetyBanner />
      <QuickActions />
      <HealthSummaryStrip />

      {/* Today: medication plan + schedule */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <MedicationsToday />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <UpcomingAppointment />
          <WeekStrip />
        </div>
      </div>

      <VitalsTrend />

      {/* Deeper health picture */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 items-stretch">
        <div className="flex lg:col-span-4">
          <WellnessScore className="w-full" />
        </div>
        <div className="flex lg:col-span-4">
          <BodyOverview className="w-full" />
        </div>
        <div className="flex md:col-span-2 lg:col-span-4">
          <RecentActivity className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <div className="flex lg:col-span-7">
          <RecentRecords className="w-full" />
        </div>
        <div className="flex lg:col-span-5">
          <NotificationsPreview className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        <div className="flex lg:col-span-5">
          <InsuranceCoverage className="w-full" />
        </div>
        <div className="flex lg:col-span-7">
          <CareAssistant className="w-full" />
        </div>
      </div>
    </div>
  );
}
