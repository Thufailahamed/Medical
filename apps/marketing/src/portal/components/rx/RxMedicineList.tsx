import { Pill } from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Empty } from "@/portal/components/ui/Empty";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { formatDate } from "@/portal/lib/format";

export interface RxMedicineItem {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  timing?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
}

function humanize(value?: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RxMedicineList({
  medicines,
  title,
  emptyTitle,
}: {
  medicines: RxMedicineItem[];
  title: string;
  emptyTitle: string;
}) {
  return (
    <Card padding={false} className="dashboard-card overflow-hidden">
      <div className="px-5 pt-5">
        <CardHeader
          title={title}
          icon={<Pill size={15} className="text-brand" />}
          right={
            medicines.length > 0 ? (
              <PillBadge tone="brand">
                {medicines.length} {medicines.length === 1 ? "med" : "meds"}
              </PillBadge>
            ) : null
          }
        />
      </div>

      {medicines.length === 0 ? (
        <Empty title={emptyTitle} className="py-8" />
      ) : (
        <ul className="portal-rx-med-list">
          {medicines.map((med, idx) => {
            const freq = humanize(med.frequency);
            const timing = humanize(med.timing);
            const schedule = [freq, timing].filter(Boolean).join(" · ");
            const duration =
              med.startDate && med.endDate
                ? `${formatDate(med.startDate)} → ${formatDate(med.endDate)}`
                : null;
            const meta = [schedule, duration].filter(Boolean).join(" · ");

            return (
              <li key={med.id} className="portal-rx-med-item">
                <div className="portal-rx-med-icon" aria-hidden>
                  <Pill size={15} />
                </div>
                <div className="portal-rx-med-body">
                  <div className="portal-rx-med-title-row">
                    <span className="portal-rx-med-index">#{idx + 1}</span>
                    <span className="portal-rx-med-name">{med.name}</span>
                    {med.dosage ? (
                      <PillBadge tone="neutral">{med.dosage}</PillBadge>
                    ) : null}
                    {!med.endDate ? (
                      <PillBadge tone="info">Ongoing</PillBadge>
                    ) : null}
                  </div>
                  {meta ? <p className="portal-rx-med-meta">{meta}</p> : null}
                  {med.instructions ? (
                    <p className="portal-rx-med-instructions">{med.instructions}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
