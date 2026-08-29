"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useProfile } from "@/patient/hooks";
import { logout } from "@/portal/lib/auth";

function initials(name: string | null | undefined) {
  return (name ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const query = useProfile();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace("/patient/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="You"
        title="Profile"
        description="Account details and verification status."
        action={
          <button
            type="button"
            onClick={onLogout}
            disabled={signingOut}
            className="inline-flex items-center gap-2 bg-danger-soft px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-60"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            <LogOut size={16} aria-hidden />
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        }
      />

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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.photo}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-pill object-cover ring-2 ring-brand-soft"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-16 w-16 place-items-center bg-brand-soft text-base font-semibold text-brand"
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
                <Field
                  label="Verification"
                  value={data.verified ? "Verified" : "Pending"}
                />
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
    <div className="rounded-inner bg-surface-2 px-3 py-2.5">
      <dt className="t-micro">{label}</dt>
      <dd className="mt-0.5 font-semibold text-text">{String(value)}</dd>
    </div>
  );
}
