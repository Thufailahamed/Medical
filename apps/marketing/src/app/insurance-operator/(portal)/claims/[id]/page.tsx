"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useInsuranceOperatorClaim,
  useDecideClaim,
  usePostClaimMessageOperator,
} from "../../../hooks/useApi";

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-700",
  under_review: "bg-blue-100 text-blue-700",
  more_info_needed: "bg-orange-100 text-orange-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
};

export default function ClaimReviewPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const router = useRouter();
  const { data, isLoading } = useInsuranceOperatorClaim(id);
  const decide = useDecideClaim();
  const postMsg = usePostClaimMessageOperator();

  const [approvedAmount, setApprovedAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reply, setReply] = useState("");

  if (isLoading) {
    return <div className="text-gray-500">Loading…</div>;
  }
  const claim = data?.claim;
  if (!claim) {
    return <div className="text-gray-500">Claim not found.</div>;
  }

  const onDecide = async (decision: "approve" | "reject" | "more_info") => {
    await decide.mutateAsync({
      id,
      decision,
      amountApprovedLkr:
        decision === "approve" && approvedAmount
          ? Number(approvedAmount)
          : undefined,
      remarks: remarks || undefined,
    });
  };

  const onSend = async () => {
    if (!reply.trim()) return;
    await postMsg.mutateAsync({ id, body: reply.trim() });
    setReply("");
  };

  return (
    <div>
      <button
        onClick={() => router.push("/insurance-operator/claims")}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to queue
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {claim.patientName}
                </h1>
                <p className="text-sm text-gray-500">
                  Policy {claim.policyNumber} · Treatment:{" "}
                  {claim.treatmentType.replace(/_/g, " ")}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  STATUS_BADGE[claim.status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {claim.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Requested</p>
                <p className="text-lg font-bold">
                  LKR {claim.amountRequestedLkr.toLocaleString()}
                </p>
              </div>
              {typeof claim.amountApprovedLkr === "number" ? (
                <div>
                  <p className="text-xs text-gray-500">Approved</p>
                  <p className="text-lg font-bold text-emerald-600">
                    LKR {claim.amountApprovedLkr.toLocaleString()}
                  </p>
                </div>
              ) : null}
            </div>

            {claim.facility ? (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Facility</p>
                <p className="text-sm">{claim.facility}</p>
              </div>
            ) : null}
            {claim.diagnosis ? (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Diagnosis</p>
                <p className="text-sm">{claim.diagnosis}</p>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Documents</h2>
            {claim.documents.length === 0 ? (
              <p className="text-sm text-gray-500">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2">
                {claim.documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between text-sm border border-gray-100 rounded-xl px-3 py-2"
                  >
                    <span className="capitalize">
                      {d.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500">{d.fileKey}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">
              Conversation with claimant
            </h2>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {claim.messages.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                claim.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      m.senderRole === "insurance"
                        ? "bg-sky-50 border border-sky-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-medium">{m.senderName}</span>
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to claimant…"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <button
                onClick={onSend}
                disabled={!reply.trim() || postMsg.isPending}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-fit sticky top-4">
          <h2 className="font-semibold text-gray-900 mb-3">Decision</h2>

          <label className="block text-xs text-gray-500 mb-1">
            Approved amount (LKR)
          </label>
          <input
            type="number"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-3"
          />

          <label className="block text-xs text-gray-500 mb-1">
            Remarks for claimant
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-4"
          />

          <div className="space-y-2">
            <button
              onClick={() => onDecide("approve")}
              disabled={decide.isPending}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => onDecide("more_info")}
              disabled={decide.isPending}
              className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-50"
            >
              Request more info
            </button>
            <button
              onClick={() => onDecide("reject")}
              disabled={decide.isPending}
              className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}