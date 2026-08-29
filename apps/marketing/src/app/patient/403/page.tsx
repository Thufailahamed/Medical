import Link from "next/link";

export default function PatientForbiddenPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md bg-surface p-10 text-center"
        style={{
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p className="t-label">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-text">
          This area is for patients
        </h1>
        <p className="mt-3 text-sm text-text-soft">
          Your account is signed in with a clinical role. Use the clinician
          portal to see your patients, schedule and prescriptions.
        </p>
        <Link
          href="/portal/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center bg-ink px-6 text-sm font-semibold text-white transition-shadow hover:shadow-float"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          Go to the clinician portal
        </Link>
      </div>
    </main>
  );
}