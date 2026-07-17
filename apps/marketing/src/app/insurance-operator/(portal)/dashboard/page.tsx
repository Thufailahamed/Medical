"use client";

import { useRouter } from "next/navigation";
import { useInsuranceOperatorDashboard } from "../../hooks/useApi";

const STAT_CARDS = [
  { key: "totalEnrollments", label: "Total Enrollments", icon: "🛡️", color: "bg-sky-50 text-sky-700" },
  { key: "activeEnrollments", label: "Active", icon: "✅", color: "bg-emerald-50 text-emerald-700" },
  { key: "pendingClaims", label: "Pending Claims", icon: "⏳", color: "bg-amber-50 text-amber-700" },
  { key: "approvedClaimsMtd", label: "Approved (MTD)", icon: "👍", color: "bg-indigo-50 text-indigo-700" },
] as const;

export default function InsuranceOperatorDashboard() {
  const router = useRouter();
  const { data, isLoading } = useInsuranceOperatorDashboard();
  const stats = data?.stats;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Operator Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Review claims, approve payouts, and manage your policyholders.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}
              >
                <span className="text-lg">{card.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-500">
                {card.label}
              </span>
            </div>
            {isLoading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">
                {stats?.[card.key as keyof typeof stats] ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {stats ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
          <h3 className="font-semibold text-gray-900 mb-1">
            Premium collected this month
          </h3>
          <p className="text-3xl font-bold text-sky-700">
            LKR {stats.premiumCollectedMtd.toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => router.push("/insurance-operator/claims?status=pending")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">📋 Review Claims</h3>
          <p className="text-sm text-gray-500">
            Approve, reject, or request more info for submitted claims.
          </p>
        </button>

        <button
          onClick={() => router.push("/insurance-operator/enrollments")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">🛡️ Enrollments</h3>
          <p className="text-sm text-gray-500">
            View all active policies issued by your company.
          </p>
        </button>
      </div>
    </div>
  );
}