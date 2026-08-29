"use client";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useProfile } from "@/patient/hooks";

function initials(name: string | null | undefined) {
  return (name ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const query = useProfile();
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader label="You" title="Profile" />

      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={4}
          emptyTitle="No profile loaded"
          emptyDescription="Profile details land here once you're signed in."
        >
          {(data) => (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                {data.photo ? (
                  <img
                    src={data.photo}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-pill object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-16 w-16 place-items-center bg-surface-3 text-base font-semibold text-text-soft"
                    style={{ borderRadius: "var(--radius-pill)" }}
                  >
                    {initials(data.name) || "?"}
                  </span>
                )}
                <div>
                  <p className="t-card-title">{data.name ?? "—"}</p>
                  <p className="t-micro">{data.email ?? data.phone ?? ""}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Field label="Email" value={data.email ?? "—"} />
                <Field label="Phone" value={data.phone ?? "—"} />
                <Field label="Role" value={data.role ?? "patient"} />
                <Field label="Verification" value={data.verified ? "Verified" : "Pending"} />
                <Field label="Status" value={data.status ?? "active"} />
                <Field label="ID" value={data.id ?? "—"} />
              </dl>
            </div>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="t-micro">{label}</dt>
      <dd className="font-medium text-text">{String(value)}</dd>
    </div>
  );
}
