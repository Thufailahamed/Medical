"use client";

import { useInsuranceOperatorEnrollments } from "../../hooks/useApi";

export default function OperatorEnrollmentsPage() {
  const { data, isLoading } = useInsuranceOperatorEnrollments();
  const rows = data?.enrollments ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
        <p className="text-gray-500 mt-1">
          All active and historical policies issued by your company.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse h-20" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
          No enrollments yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Policyholder</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Premium</th>
                <th className="px-6 py-3 text-right">Coverage</th>
                <th className="px-6 py-3">Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {e.userName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {e.planName}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="capitalize">{e.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-right">
                    LKR {e.premiumAmountLkr.toLocaleString()} / {e.billingCycle}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    LKR {e.coverageAmountLkr.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {e.nextPremiumDueAt
                      ? new Date(e.nextPremiumDueAt).toLocaleDateString()
                      : "—"}
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