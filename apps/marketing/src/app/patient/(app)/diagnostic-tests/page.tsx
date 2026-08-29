"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";

interface DiagnosticTest {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  price: number;
  discountPrice: number | null;
  sampleType: string | null;
  homeCollectionAvailable: boolean;
}

interface Package {
  id: string;
  slug: string;
  name: string;
  price: number;
  discountPrice: number | null;
  testCount: number;
  savings: number;
}

export default function DiagnosticTestsPage() {
  const [search, setSearch] = useState("");
  const tests = useQuery({
    queryKey: ["patient", "diagnostic-tests", "catalog", search],
    queryFn: () => api<{ tests: DiagnosticTest[]; total: number }>(`/diagnostic-tests/catalog?limit=50${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),
  });
  const packages = useQuery({
    queryKey: ["patient", "diagnostic-tests", "packages"],
    queryFn: () => api<{ packages: Package[] }>("/diagnostic-tests/packages"),
  });

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Diagnostics" title="Diagnostic tests" description="Browse available tests and packages for home sample collection." />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tests" className="h-11 rounded-inner border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
      <Card>
        <h2 className="text-sm font-bold text-text">Tests</h2>
        <QueryBoundary query={tests} loadingCount={4} emptyTitle="No tests found" emptyDescription="Try a different search." className="mt-3">
          {(data) => (
            <ul className="mt-3 flex flex-col gap-2">
              {data.tests.map((test) => (
                <li key={test.id}>
                  <Link href={`/patient/diagnostic-tests/${test.slug}`} className="flex items-center gap-3 rounded-inner bg-surface-2 px-3 py-3 hover:bg-surface-3">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{test.name}</span><span className="text-xs text-text-soft">{test.category ?? "General"} · {test.sampleType ?? "Sample collection"}</span></span>
                    <span className="text-sm font-semibold text-text">LKR {test.discountPrice ?? test.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
      <Card>
        <h2 className="text-sm font-bold text-text">Packages</h2>
        <QueryBoundary query={packages} loadingCount={3} emptyTitle="No packages available" emptyDescription="Check back for diagnostic packages." className="mt-3">
          {(data) => (
            <ul className="mt-3 flex flex-col gap-2">
              {data.packages.map((pkg) => (
                <li key={pkg.id} className="flex items-center gap-3 rounded-inner bg-surface-2 px-3 py-3"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{pkg.name}</span><span className="text-xs text-text-soft">{pkg.testCount} tests{pkg.savings > 0 ? ` · save LKR ${pkg.savings}` : ""}</span></span><span className="text-sm font-semibold text-text">LKR {pkg.discountPrice ?? pkg.price}</span></li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
