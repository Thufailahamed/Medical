import { formatDateTime } from "@/portal/lib/format";

type TFn = (key: string) => string;

export interface RxAuditEntry {
  id: string;
  action: string;
  details: unknown;
  createdAt: string;
}

function parseDetails(details: unknown): Record<string, unknown> | null {
  if (!details) return null;
  if (typeof details === "string") {
    try {
      return JSON.parse(details) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof details === "object") {
    return details as Record<string, unknown>;
  }
  return null;
}

export function auditActionLabel(t: TFn, action: string): string {
  const a = action.toLowerCase();
  if (a.includes("sign")) return t("audit.actions.sign");
  if (a.includes("cancel")) return t("audit.actions.cancel");
  if (a.includes("dispense")) return t("audit.actions.dispense");
  if (a.includes("edit")) return t("audit.actions.update");
  if (a.includes("create")) return t("audit.actions.create");
  return t("audit.actions.other");
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-text-soft">{label}: </span>
      <span className="text-text-muted">{value}</span>
    </div>
  );
}

function MonoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-text-soft">{label}</div>
      <div className="font-mono text-[10px] leading-relaxed break-all text-text-muted mt-0.5">
        {value}
      </div>
    </div>
  );
}

export function RxAuditDetails({
  action,
  details,
  t,
}: {
  action: string;
  details: unknown;
  t: TFn;
}) {
  const parsed = parseDetails(details);
  if (!parsed) return null;

  if (action === "prescription.signed") {
    return (
      <div className="mt-1.5 space-y-1.5 text-[11px]">
        {typeof parsed.payloadHash === "string" ? (
          <MonoLine label={t("prescription.payloadHash")} value={parsed.payloadHash} />
        ) : null}
        {typeof parsed.signatureId === "string" ? (
          <MonoLine label="Signature ID" value={parsed.signatureId} />
        ) : null}
        {typeof parsed.keyId === "string" ? (
          <MonoLine label="Signing key" value={parsed.keyId} />
        ) : null}
      </div>
    );
  }

  if (action === "prescription.cancelled") {
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason
        : null;
    return (
      <div className="mt-1.5 space-y-1 text-[11px]">
        {typeof parsed.from === "string" ? (
          <DetailLine label="Previous status" value={parsed.from} />
        ) : null}
        {reason ? <DetailLine label="Reason" value={reason} /> : null}
      </div>
    );
  }

  if (action === "prescription.dispensed") {
    return typeof parsed.dispensedAt === "string" ? (
      <div className="mt-1.5 text-[11px]">
        <DetailLine
          label="Dispensed at"
          value={formatDateTime(parsed.dispensedAt)}
        />
      </div>
    ) : null;
  }

  if (
    action === "prescription.edited" ||
    action === "prescription.edit_with_warnings"
  ) {
    const changes: string[] = [];
    if (parsed.diagnosisChanged) changes.push("diagnosis");
    if (parsed.notesChanged) changes.push("notes");
    if (parsed.itemsChanged) changes.push("medicines");
    return changes.length ? (
      <div className="mt-1.5 text-[11px]">
        <DetailLine label="Changed" value={changes.join(", ")} />
      </div>
    ) : null;
  }

  return null;
}
