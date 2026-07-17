"use client";

import { useLabPackages } from "../../hooks/useApi";

export default function PackagesPage() {
  const { data, isLoading } = useLabPackages();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Packages</h1>
          <p className="text-gray-500 mt-1">Manage bundled test packages</p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition">
          + Create Package
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : data?.packages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <p className="text-gray-500">No packages yet. Create one to offer bundled test discounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                  {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
                  <p className="text-sm text-gray-500 mt-2">
                    {pkg.testCount} tests • Results in {pkg.turnaroundHours}h
                  </p>
                </div>
                <div className="text-right">
                  {pkg.discountPrice && (
                    <p className="text-sm text-gray-400 line-through">Rs. {pkg.price.toLocaleString("en-LK")}</p>
                  )}
                  <p className="text-xl font-bold text-gray-900">
                    Rs. {(pkg.discountPrice ?? pkg.price).toLocaleString("en-LK")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
