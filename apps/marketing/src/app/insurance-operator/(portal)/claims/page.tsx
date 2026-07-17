"use client";

import { useSearchParams, useRouter } from "next/navigation";
import {
  useInsuranceOperatorClaims,
  InsuranceOperatorClaim,
} from "../../hooks/useApi";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "more_info_needed", label: "Needs Info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-700",
  under_review: "bg-blue-100 text-blue-700",
  more_info_needed: "bg-orange-100 text-orange-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
};

export default function ClaimsQueuePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const status = sp.get("status") ?? undefined;
  const { data, isLoading } = useInsuranceOperatorClaims(status);
  const claims: InsuranceOperatorClaim[] = data?.claims ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claims Queue</h1>
          <p className="text-gray-500 mt-1">
            Review and decide on reimbursement claims.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-2 mb-6 flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = (tab.value ?? "") === (status ?? "");
          return (
            <button
              key={tab.label}
              onClick={() => {
                const q = tab.value ? `?status=${tab.value}` : "";
                router.replace(`/insurance-operator/claims${q}`);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                active
                  ? "bg-sky-100 text-sky-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse h-20" />
          ))}
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
          No claims match this filter.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Claimant</th>
                <th className="px-6 py-3">Policy</th>
                <th className="px-6 py-3">Treatment</th>
                <th className="px-6 py-3 text-right">Requested</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    router.push(`/insurance-operator/claims/${c.id}`)
                  }
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {c.patientName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {c.policyNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {c.treatmentType.replace(/_/g, " ")}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right">
                    LKR {c.amountRequestedLkr.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-sky-600 font-medium">
                    Review →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}