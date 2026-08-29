import {
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
 * The dashboard is the page patients land on. Layout is a single
 * top-row spanning grid that holds the wellness + trend cards, then a
 * second row with the four feed panels and the chat prompt at the
 * bottom. Spacing tokens (gap-6, p-6) come from the global Tailwind
 * config — nothing bespoke lives here so the layout can stay
 * declarative.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <VitalsTrend className="xl:col-span-2" />
        <WellnessScore />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <UpcomingAppointment />
        <MedicationsToday />
        <WeekStrip />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentRecords />
        <RecentActivity />
      </div>

      <CareAssistant />
    </div>
  );
}
