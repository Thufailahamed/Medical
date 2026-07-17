"use client";

import { useRouter } from "next/navigation";
import { useLabDashboard } from "../../hooks/useApi";

const STAT_CARDS = [
  { key: "todayBookings", label: "Today's Bookings", icon: "📅", color: "bg-blue-50 text-blue-700" },
  { key: "pendingBookings", label: "Pending", icon: "⏳", color: "bg-amber-50 text-amber-700" },
  { key: "completedBookings", label: "Completed", icon: "✅", color: "bg-emerald-50 text-emerald-700" },
  { key: "activeTests", label: "Active Tests", icon: "🧪", color: "bg-purple-50 text-purple-700" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useLabDashboard();

  const stats = data?.stats;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your diagnostic services</p>
      </div>

      {/* Stat Cards */}
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
                {stats?.[card.key] ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => router.push("/lab-portal/bookings?status=pending")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">📋 Pending Bookings</h3>
          <p className="text-sm text-gray-500">
            Review and confirm incoming test bookings
          </p>
        </button>

        <button
          onClick={() => router.push("/lab-portal/catalog")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">🧪 Manage Catalog</h3>
          <p className="text-sm text-gray-500">
            Add, edit, or deactivate tests in your catalog
          </p>
        </button>

        <button
          onClick={() => router.push("/lab-portal/phlebotomists")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">👨‍⚕️ Phlebotomists</h3>
          <p className="text-sm text-gray-500">
            Manage your sample collection team
          </p>
        </button>

        <button
          onClick={() => router.push("/lab-portal/packages")}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md transition"
        >
          <h3 className="font-semibold text-gray-900 mb-1">📦 Test Packages</h3>
          <p className="text-sm text-gray-500">
            Create and manage bundled test packages
          </p>
        </button>
      </div>
    </div>
  );
}
