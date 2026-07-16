// ShareModeSheet — Tier 1 records: PR2 unified share entry point.
//
// One shell collapses three previously-distinct sharing mechanisms:
//   - Visit      → share link with expiry (POST /share/links)
//   - Ongoing    → purpose-bound consent grant (POST /consents)
//   - In-person  → QR token display (POST /emergency/qr/issue)
//
// When invoked with `recordIds` (multi-select flow), the Visit path
// takes the user straight into the share-pack flow (kind=record_bundle)
// without re-picking records. Single-record and no-record callers
// fall through to the regular single-record share-link form.
//
// Sub-flows are inlined rather than nested as separate bottom-sheets
// so the user sees the mode choice and the form in one context — no
// stacking sheet modals which on Android can be confusing.

import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Link2, ShieldCheck, QrCode, ArrowLeft } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";

import {
  CONSENT_PURPOSES,
  PURPOSE_REGISTRY,
} from "@healthcare/shared/records";

import {
  useCreateShareLink,
  useCreateSharePack,
  useIssueConsent,
  useIssueQrToken,
} from "@/hooks/useApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { AppText } from "@/components/ui/AppText";
import { TextInput } from "@/components/ui/TextInput";
import { FormField } from "@/components/ui/FormField";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Mode = "pick" | "visit" | "ongoing" | "in-person";

interface Props {
  open: boolean;
  onClose: () => void;
  recordId?: string;
  recordIds?: string[];
  familyMemberId?: string;
}

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 168, label: "1 week" },
  { hours: 720, label: "30 days" },
];

export function ShareModeSheet({
  open,
  onClose,
  recordId,
  recordIds,
  familyMemberId,
}: Props) {
  const [mode, setMode] = useState<Mode>("pick");
  const hasPack = (recordIds?.length ?? 0) > 0;

  // Reset to picker whenever the sheet re-opens.
  React.useEffect(() => {
    if (open) setMode("pick");
  }, [open]);

  const close = () => {
    setMode("pick");
    onClose();
  };

  return (
    <BottomSheet
      visible={open}
      onDismiss={close}
      title={
        mode === "pick"
          ? "Share"
          : mode === "visit"
            ? "Share for a visit"
            : mode === "ongoing"
              ? "Ongoing access"
              : "Show in person"
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        {mode === "pick" ? (
          <ModePicker
            hasPack={hasPack}
            onPick={setMode}
          />
        ) : mode === "visit" ? (
          <VisitFlow
            recordId={recordId}
            recordIds={recordIds}
            familyMemberId={familyMemberId}
            onBack={() => setMode("pick")}
            onDone={close}
          />
        ) : mode === "ongoing" ? (
          <OngoingFlow
            onBack={() => setMode("pick")}
            onDone={close}
          />
        ) : (
          <InPersonFlow
            onBack={() => setMode("pick")}
            onDone={close}
          />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Mode picker (3 big cards) ─────────────────────────────

function ModePicker({
  hasPack,
  onPick,
}: {
  hasPack: boolean;
  onPick: (m: Mode) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <AppText variant="body.sm" color="muted">
        {hasPack
          ? "How would you like to share the selected records?"
          : "Pick how to share. Each mode has a different expiry and audience."}
      </AppText>

      <ModeCard
        icon={<Link2 size={20} color="#2563eb" />}
        title={hasPack ? "Share pack for visit" : "Share for a visit"}
        subtitle="A link that expires — perfect for one appointment."
        onPress={() => onPick("visit")}
        recommended={hasPack}
      />
      <ModeCard
        icon={<ShieldCheck size={20} color="#0f766e" />}
        title="Ongoing access"
        subtitle="Long-term access tied to a purpose — family, insurance, referral."
        onPress={() => onPick("ongoing")}
      />
      <ModeCard
        icon={<QrCode size={20} color="#7c3aed" />}
        title="Show in person"
        subtitle="Display a QR code at the clinic — they scan and you're verified."
        onPress={() => onPick("in-person")}
      />
    </View>
  );
}

function ModeCard({
  icon,
  title,
  subtitle,
  onPress,
  recommended,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  recommended?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.modeCard,
      pressed && { opacity: 0.85 },
    ]}>
      <View style={styles.modeIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText variant="title.sm">{title}</AppText>
          {recommended ? (
            <Pill tone="info">Recommended</Pill>
          ) : null}
        </View>
        <AppText variant="body.sm" color="muted">{subtitle}</AppText>
      </View>
    </Pressable>
  );
}

// ─── Visit flow (share link / pack) ────────────────────────

function VisitFlow({
  recordId,
  recordIds,
  familyMemberId,
  onBack,
  onDone,
}: {
  recordId?: string;
  recordIds?: string[];
  familyMemberId?: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(24);
  const createLink = useCreateShareLink();
  const createPack = useCreateSharePack();
  const toast = useToast();

  const isPack = (recordIds?.length ?? 0) > 0;
  const pending = createLink.isPending || createPack.isPending;

  const submit = async () => {
    try {
      if (isPack && recordIds) {
        await createPack.mutateAsync({
          label: label.trim() || undefined,
          expiresInHours: hours,
          recordIds,
        });
        toast({ title: "Share pack created", tone: "success" });
      } else {
        await createLink.mutateAsync({
          label: label.trim() || undefined,
          expiresInHours: hours,
          scope: "all",
          ...(recordId ? { recordId } : {}),
          ...(familyMemberId ? { familyMemberId } : {}),
        });
        toast({ title: "Share link created", tone: "success" });
      }
      onDone();
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />

      {isPack ? (
        <AppText variant="body.sm" color="muted">
          Bundling {recordIds!.length} record{recordIds!.length === 1 ? "" : "s"} into one link.
        </AppText>
      ) : null}

      <FormField label="Label (optional)">
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={isPack ? "e.g. Pre-cardiology visit" : "e.g. Dr Smith follow-up"}
        />
      </FormField>

      <View>
        <AppText variant="body.sm" color="muted">Expires in</AppText>
        <View style={styles.chipRow}>
          {EXPIRY_OPTIONS.map((opt) => (
            <Pill
              key={opt.hours}
              tone={hours === opt.hours ? "info" : "neutral"}
              onPress={() => setHours(opt.hours)}
            >
              {opt.label}
            </Pill>
          ))}
        </View>
      </View>

      <Button label={isPack ? "Create share pack" : "Create link"} onPress={submit} loading={pending} />
    </View>
  );
}

// ─── Ongoing flow (consent grant) ──────────────────────────

function OngoingFlow({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [purpose, setPurpose] = useState<string>(CONSENT_PURPOSES[0]);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [label, setLabel] = useState("");
  const issue = useIssueConsent();
  const toast = useToast();

  const submit = async () => {
    try {
      await issue.mutateAsync({
        purpose,
        durationDays,
        label: label || undefined,
        scope: { kinds: ["*"] },
      });
      toast({ title: "Consent issued", tone: "success" });
      onDone();
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />

      <AppText variant="body.sm" color="muted">
        Purpose-bound grant. The recipient gets scoped access until it expires.
      </AppText>

      <View>
        <AppText variant="body.sm" color="muted">Purpose</AppText>
        <View style={styles.chipRow}>
          {CONSENT_PURPOSES.map((p) => (
            <Pill
              key={p}
              tone={purpose === p ? "info" : "neutral"}
              onPress={() => setPurpose(p)}
            >
              {PURPOSE_REGISTRY[p]?.labelKey.split(".").pop() ?? p}
            </Pill>
          ))}
        </View>
      </View>

      <FormField label="Duration (days)">
        <TextInput
          value={String(durationDays)}
          keyboardType="numeric"
          onChangeText={(s) => setDurationDays(parseInt(s || "30", 10) || 30)}
        />
      </FormField>

      <FormField label="Label (optional)">
        <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Insurance review" />
      </FormField>

      <Button label="Issue consent" onPress={submit} loading={issue.isPending} />
    </View>
  );
}

// ─── In-person flow (QR display) ───────────────────────────

function InPersonFlow({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const issue = useIssueQrToken();
  const toast = useToast();
  const [token, setToken] = useState<{
    token: string;
    expiresAt: string;
    maxScans: number;
    url: string;
  } | null>(null);

  const generate = async () => {
    try {
      const r = await issue.mutateAsync({ maxScans: 5, ttlHours: 2 });
      setToken(r);
      toast({ title: "QR token issued", tone: "success" });
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <BackRow onBack={onBack} />

      <AppText variant="body.sm" color="muted">
        A QR code that the clinic can scan once — useful when you can't hand over a link.
      </AppText>

      {!token ? (
        <Button label="Generate QR token" onPress={generate} loading={issue.isPending} />
      ) : (
        <Card>
          <View style={{ alignItems: "center", gap: 8 }}>
            <QRCode value={token.url} size={180} />
            <AppText variant="body.sm" color="muted">
              {token.maxScans} scans · expires {new Date(token.expiresAt).toLocaleString()}
            </AppText>
            <Button label="Generate new" tone="ghost" onPress={() => setToken(null)} />
            <Button label="Done" onPress={onDone} />
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <Pressable onPress={onBack} style={styles.backRow}>
      <ArrowLeft size={14} color="#475569" />
      <AppText variant="body.sm" color="muted">Back to modes</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  modeCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "flex-start",
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});