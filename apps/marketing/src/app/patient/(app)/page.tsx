import {
  BodyOverview,
  CareAssistant,
  MedicationsToday,
  RecentActivity,
  RecentRecords,
  UpcomingAppointment,
  VitalsTrend,
  WeekStrip,
  WellnessScore,
} from "@/patient/components/dashboard";

/**
 * Health Monitoring dashboard — three-column composition matching
 * the patient portal design system, powered by real patient data.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <header className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="t-label">Overview</p>
          <h2 className="t-page mt-1 text-text">Health Monitoring</h2>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left column */}
        <div className="flex flex-col gap-5 xl:col-span-4">
          <VitalsTrend />
          <CareAssistant />
        </div>

        {/* Center — body */}
        <div className="xl:col-span-4">
          <BodyOverview className="h-full" />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 xl:col-span-4">
          <WeekStrip />
          <MedicationsToday />
          <WellnessScore />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <UpcomingAppointment />
        <RecentRecords />
        <RecentActivity />
      </div>
    </div>
  );
}
