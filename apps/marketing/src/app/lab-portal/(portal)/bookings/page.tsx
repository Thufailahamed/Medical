"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLabBookings, useConfirmBooking } from "../../hooks/useApi";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Assigned" },
  { key: "sample_collected", label: "Collected" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  phlebotomist_assigned: "bg-purple-100 text-purple-700",
  sample_collection_en_route: "bg-orange-100 text-orange-700",
  sample_collected: "bg-cyan-100 text-cyan-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [status, setStatus] = useState(initialStatus);
  const { data, isLoading } = useLabBookings(status || undefined);
  const confirmBooking = useConfirmBooking();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 mt-1">Manage test bookings and sample collection</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              status === tab.key
                ? "bg-emerald-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse"
            >
              <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data?.bookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <p className="text-gray-500">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.bookings.map((booking) => (
            <div
              key={booking.id}
              onClick={() =>
                router.push(`/lab-portal/bookings/${booking.id}`)
              }
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {booking.itemName || "Test Booking"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {booking.patientName || "Patient"} • {booking.scheduledDate}{" "}
                    {booking.scheduledTimeSlot}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {booking.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  📍 {booking.collectionAddress?.line1},{" "}
                  {booking.collectionAddress?.city}
                </p>
                <p className="font-semibold text-gray-900">
                  Rs. {booking.totalPrice.toLocaleString("en-LK")}
                </p>
              </div>

              {booking.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmBooking.mutate(booking.id);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
