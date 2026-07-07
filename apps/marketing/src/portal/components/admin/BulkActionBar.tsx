"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { adminApi, adminApiWithStepUp, setStepUpToken } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";

type BulkKind = "approve" | "reject" | "suspend" | "unsuspend" | "delete";

export interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  // Query keys to invalidate after a successful bulk op.
  invalidateKeys: ReadonlyArray<readonly unknown[]>;
}

interface BulkResult {
  results: Array<{ userId: string; status: "ok" | "error"; code?: string; message?: string }>;
  successCount: number;
  failureCount: number;
}

const LABELS: Record<BulkKind, { verb: string; needsReason: boolean; needsConfirm: boolean; tone: string }> = {
  approve:    { verb: "Approve",    needsReason: false, needsConfirm: false, tone: "bg-emerald-600 hover:bg-emerald-700" },
  reject:     { verb: "Reject",     needsReason: true,  needsConfirm: false, tone: "bg-amber-600 hover:bg-amber-700" },
  suspend:    { verb: "Suspend",    needsReason: true,  needsConfirm: false, tone: "bg-orange-600 hover:bg-orange-700" },
  unsuspend:  { verb: "Unsuspend",  needsReason: false, needsConfirm: false, tone: "bg-blue-600 hover:bg-blue-700" },
  delete:     { verb: "Delete",     needsReason: false, needsConfirm: true,  tone: "bg-red-600 hover:bg-red-700" },
};

export function BulkActionBar({ selectedIds, onClear, invalidateKeys }: BulkActionBarProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<BulkKind | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  // Acquire a fresh step-up token by running the WebAuthn
  // assertion ceremony. Used by `adminApiWithStepUp` for bulk
  // delete; one Touch ID covers the whole batch.
  async function refreshStepUp(): Promise<string> {
    const opts = await adminApi<any>("/admin/webauthn/auth/options", {
      method: "POST",
      json: {},
    });
    const credential = await getPasskey(opts);
    const res = await adminApi<{ stepUpToken: string }>(
      "/admin/webauthn/auth/verify",
      { method: "POST", json: credential },
    );
    setStepUpToken(res.stepUpToken);
    return res.stepUpToken;
  }

  const mut = useMutation({
    mutationFn: async (input: { kind: BulkKind; body: Record<string, unknown> }) => {
      // Delete is destructive → server requires a fresh step-up
      // token. The wrapper opens the StepUpModal on 401 step-up
      // and re-issues once a passkey assertion succeeds.
      if (input.kind === "delete") {
        return adminApiWithStepUp<BulkResult>(`/admin/bulk/${input.kind}`, {
          method: "POST",
          json: input.body,
        }, refreshStepUp);
      }
      return adminApi<BulkResult>(`/admin/bulk/${input.kind}`, {
        method: "POST",
        json: input.body,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      setOpen(null);
      setReason("");
      setConfirmText("");
    },
  });

  function handleAction(kind: BulkKind) {
    setResult(null);
    setOpen(kind);
  }

  function handleSubmit() {
    if (!open) return;
    const meta = LABELS[open];
    const body: Record<string, unknown> = { userIds: selectedIds };
    if (meta.needsReason) body.reason = reason.trim();
    if (meta.needsConfirm) body.confirm = true;
    mut.mutate({ kind: open, body });
  }

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-30 bg-amber-50 border border-amber-200 rounded-2xl shadow-lg p-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 flex items-center gap-2 px-2">
          <span className="font-semibold text-sm text-amber-900">
            {selectedIds.length} selected
          </span>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
          >
            <X size={12} /> Clear
          </button>
        </div>
        {(Object.keys(LABELS) as BulkKind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            onClick={() => handleAction(k)}
            disabled={mut.isPending}
            className={`${LABELS[k].tone} text-white`}
          >
            {LABELS[k].verb}
          </Button>
        ))}
      </div>

      {result ? (
        <Modal
          open={true}
          onClose={() => setResult(null)}
          title="Bulk operation complete"
          size="md"
          footer={
            <div className="flex justify-end">
              <Button onClick={() => { setResult(null); onClear(); }}>Done</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={16} />
                <span><b>{result.successCount}</b> succeeded</span>
              </div>
              {result.failureCount > 0 ? (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={16} />
                  <span><b>{result.failureCount}</b> failed</span>
                </div>
              ) : null}
            </div>
            {result.failureCount > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-bg">
                    <tr>
                      <th className="text-left px-2 py-1">User ID</th>
                      <th className="text-left px-2 py-1">Code</th>
                      <th className="text-left px-2 py-1">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.filter((r) => r.status === "error").map((r) => (
                      <tr key={r.userId} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">{r.userId}</td>
                        <td className="px-2 py-1">{r.code}</td>
                        <td className="px-2 py-1">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${LABELS[open].verb} ${selectedIds.length} user${selectedIds.length === 1 ? "" : "s"}` : ""}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                mut.isPending ||
                Boolean(open && LABELS[open].needsReason && reason.trim().length < 3) ||
                Boolean(open && LABELS[open].needsConfirm && confirmText !== `DELETE ${selectedIds.length}`)
              }
              className={open ? `${LABELS[open].tone} text-white` : ""}
            >
              {mut.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              {open ? LABELS[open].verb : ""}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-soft">
            You are about to <b>{open ? LABELS[open].verb.toLowerCase() : ""}</b> {selectedIds.length} user
            {selectedIds.length === 1 ? "" : "s"}. This action will be audited.
          </p>
          {open && LABELS[open].needsReason ? (
            <div>
              <label className="block text-xs font-semibold mb-1">Reason (min 3 chars)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-surface text-sm resize-none"
                placeholder="e.g. ToS violation"
              />
            </div>
          ) : null}
          {open && LABELS[open].needsConfirm ? (
            <div>
              <label className="block text-xs font-semibold mb-1">
                Type <span className="font-mono">DELETE {selectedIds.length}</span> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm font-mono"
                placeholder={`DELETE ${selectedIds.length}`}
              />
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}