"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useLabBookingDetail,
  useConfirmBooking,
  useAssignPhlebotomist,
  useCollectSample,
  useCompleteBooking,
  useCancelLabBooking,
  usePhlebotomists,
} from "../../../hooks/useApi";

const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Phlebotomist Assigned" },
  { key: "sample_collected", label: "Sample Collected" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useLabBookingDetail(id);
  const { data: phlebData } = usePhlebotomists();
  const confirmBooking = useConfirmBooking();
  const assignPhleb = useAssignPhlebotomist();
  const collectSample = useCollectSample();
  const completeBooking = useCompleteBooking();
  const cancelBooking = useCancelLabBooking();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedPhleb, setSelectedPhleb] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [resultPdfUrl, setResultPdfUrl] = useState("");

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!data?.booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Booking not found</p>
      </div>
    );
  }

  const booking = data.booking;
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === booking.status);

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to Bookings
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {booking.itemName || "Test Booking"}
          </h1>
          <p className="text-gray-500">
            Booking ID: {booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
          {booking.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Progress</h2>
        <div className="flex items-center gap-2">
          {STATUS_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= currentIdx
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-1 ${
                    i < currentIdx ? "bg-emerald-600" : "bg-gray-100"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STATUS_STEPS.map((step) => (
            <span key={step.key} className="text-[10px] text-gray-500 w-16 text-center">
              {step.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient & Schedule Info */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Booking Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Patient</dt>
              <dd className="font-medium">{booking.patientName || "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Date & Time</dt>
              <dd className="font-medium">
                {booking.scheduledDate} • {booking.scheduledTimeSlot}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Address</dt>
              <dd className="font-medium">
                {booking.collectionAddress?.line1}
                {booking.collectionAddress?.line2
                  ? `, ${booking.collectionAddress.line2}`
                  : ""}
                , {booking.collectionAddress?.city}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Contact</dt>
              <dd className="font-medium">
                {booking.collectionAddress?.contactPhone}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Payment</dt>
              <dd className="font-medium">
                Rs. {booking.totalPrice.toLocaleString("en-LK")} •{" "}
                {booking.paymentMethod} • {booking.paymentStatus}
              </dd>
            </div>
          </dl>
        </div>

        {/* Phlebotomist Info */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Phlebotomist</h2>
          {booking.phlebotomistName ? (
            <div>
              <p className="font-medium">{booking.phlebotomistName}</p>
              <p className="text-sm text-gray-500">{booking.phlebotomistPhone}</p>
            </div>
          ) : (
            <p className="text-gray-500">Not assigned yet</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 mt-6">
        <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {booking.status === "pending" && (
            <>
              <button
                onClick={() => confirmBooking.mutate(id)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                Confirm Booking
              </button>
              <button
                onClick={() => cancelBooking.mutate({ id })}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
              >
                Cancel
              </button>
            </>
          )}

          {(booking.status === "confirmed" || booking.status === "pending") && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Assign Phlebotomist
            </button>
          )}

          {booking.status === "phlebotomist_assigned" && (
            <button
              onClick={() => collectSample.mutate(id)}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
            >
              Mark Sample Collected
            </button>
          )}

          {(booking.status === "sample_collected" ||
            booking.status === "in_progress") && (
            <button
              onClick={() => setShowResultModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Upload Results & Complete
            </button>
          )}
        </div>
      </div>

      {/* Assign Phlebotomist Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">
              Assign Phlebotomist
            </h3>
            <select
              value={selectedPhleb}
              onChange={(e) => setSelectedPhleb(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4"
            >
              <option value="">Select phlebotomist...</option>
              {phlebData?.phlebotomists
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone})
                  </option>
                ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const phleb = phlebData?.phlebotomists.find(
                    (p) => p.id === selectedPhleb
                  );
                  if (phleb) {
                    assignPhleb.mutate({
                      id,
                      phlebotomistId: phleb.id,
                      phlebotomistName: phleb.name,
                      phlebotomistPhone: phleb.phone,
                    });
                    setShowAssignModal(false);
                  }
                }}
                disabled={!selectedPhleb}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Results Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">
              Upload Results
            </h3>
            <textarea
              value={resultSummary}
              onChange={(e) => setResultSummary(e.target.value)}
              placeholder="Result summary (AI will use this)..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 h-32 resize-none"
            />
            <input
              type="url"
              value={resultPdfUrl}
              onChange={(e) => setResultPdfUrl(e.target.value)}
              placeholder="PDF URL (optional)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  completeBooking.mutate({
                    id,
                    resultSummary: resultSummary || undefined,
                    resultPdfUrl: resultPdfUrl || undefined,
                  });
                  setShowResultModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Submit & Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
