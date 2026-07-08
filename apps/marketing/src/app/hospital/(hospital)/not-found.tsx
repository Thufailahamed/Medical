import Link from "next/link";
import { Card } from "@/portal/components/ui/Card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card>
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-text-muted">
          We couldn&apos;t find that page.
        </p>
        <Link
          href="/hospital/dashboard"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}