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
  WeekStrip,
} from "@/patient/components/dashboard";
import { HeroOverlap } from "@/portal/components/doctor/Workspace";

/**
 * Patient home — built from the same Workspace primitives as the doctor
 * and admin dashboards: ink hero with the stat strip floating over its
 * edge, then a main column (today's plan, vitals, records) beside a rail
 * of shortcuts, schedule, assistant, inbox and cover.
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      <div>
        <DashboardHero />
        <HeroOverlap>
          <HealthSummaryStrip />
        </HeroOverlap>
      </div>

      <SafetyBanner />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <MedicationsToday />
          <VitalsTrend />
          <RecentRecords />
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Today">
          <QuickActions />
          <UpcomingAppointment />
          <WeekStrip />
          <CareAssistant />
          <NotificationsPreview />
          <InsuranceCoverage />
        </aside>
      </div>
    </div>
  );
}
