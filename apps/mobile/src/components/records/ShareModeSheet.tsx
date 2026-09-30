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
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Link2,
  ShieldCheck,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Users,
  Target,
  ScanLine,
  RefreshCw,
  Check,
  Siren,
  HeartHandshake,
  FileSearch,
  FlaskConical,
  Microscope,
  Stethoscope,
  type LucideIcon,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";

import {
  CONSENT_PURPOSES,
  PURPOSE_REGISTRY,
  type ConsentPurpose,
} from "@healthcare/shared/records";

import {
  useCreateShareLink,
  useCreateSharePack,
  useIssueConsent,
  useIssueQrToken,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { tonePalette, type Tone } from "@/theme/tone";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TextInput } from "@/components/ui/TextInput";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";

type Mode = "pick" | "visit" | "ongoing" | "in-person";

interface Props {
  open: boolean;
  onClose: () => void;
  recordId?: string;
  recordIds?: string[];
  familyMemberId?: string;
}

const EXPIRY_HOURS = [1, 24, 168, 720] as const;
const DURATION_DAYS = [1, 7, 30, 90, 365, 730] as const;

const MODE_META: Record<Exclude<Mode, "pick">, { icon: LucideIcon; tone: Tone }> = {
  visit: { icon: Link2, tone: "primary" },
  ongoing: { icon: ShieldCheck, tone: "accent" },
  "in-person": { icon: QrCode, tone: "accent2" },
};

const PURPOSE_ICONS: Record<string, LucideIcon> = {
  emergency: Siren,
  family_view: HeartHandshake,
  insurance: FileSearch,
  research: Microscope,
  referral: Stethoscope,
  lab_share: FlaskConical,
};

// Human duration label ("1 hour", "2 weeks") via i18n plurals.
function useDurationLabel() {
  const { t } = useTranslation();
  return (hours: number) => {
    if (hours < 24) return t("shareSheet.duration.hours", { count: hours });
    const days = Math.round(hours / 24);
    if (days % 365 === 0) return t("shareSheet.duration.years", { count: days / 365 });
    if (days % 7 === 0 && days < 30) return t("shareSheet.duration.weeks", { count: days / 7 });
    return t("shareSheet.duration.days", { count: days });
  };
}

export function ShareModeSheet({
  open,
  onClose,
  recordId,
  recordIds,
  familyMemberId,
}: Props) {
  const { t } = useTranslation();
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

  const title =
    mode === "pick"
      ? t("shareSheet.title")
      : mode === "visit"
        ? t(hasPack ? "shareSheet.visit.packTitle" : "shareSheet.visit.title")
        : mode === "ongoing"
          ? t("shareSheet.ongoing.title")
          : t("shareSheet.inPerson.title");

  return (
    <BottomSheet visible={open} onDismiss={close} title={title}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {mode === "pick" ? (
          <ModePicker hasPack={hasPack} count={recordIds?.length ?? 0} onPick={setMode} />
        ) : mode === "visit" ? (
          <VisitFlow
            recordId={recordId}
            recordIds={recordIds}
            familyMemberId={familyMemberId}
            onBack={() => setMode("pick")}
            onDone={close}
          />
        ) : mode === "ongoing" ? (
          <OngoingFlow onBack={() => setMode("pick")} onDone={close} />
        ) : (
          <InPersonFlow onBack={() => setMode("pick")} onDone={close} />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Mode picker ────────────────────────────────────────────

function ModePicker({
  hasPack,
  count,
  onPick,
}: {
  hasPack: boolean;
  count: number;
  onPick: (m: Mode) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.body.md, { color: colors.textMuted }]}>
        {hasPack
          ? t("shareSheet.introPack", { count })
          : t("shareSheet.intro")}
      </Text>

      <ModeCard
        mode="visit"
        title={t(hasPack ? "shareSheet.visit.packTitle" : "shareSheet.visit.title")}
        subtitle={t("shareSheet.visit.subtitle")}
        meta={[
          { icon: Clock, label: t("shareSheet.visit.meta") },
          { icon: Link2, label: t("shareSheet.visit.meta2") },
        ]}
        onPress={() => onPick("visit")}
        recommended={hasPack}
      />
      <ModeCard
        mode="ongoing"
        title={t("shareSheet.ongoing.title")}
        subtitle={t("shareSheet.ongoing.subtitle")}
        meta={[
          { icon: Target, label: t("shareSheet.ongoing.meta") },
          { icon: Users, label: t("shareSheet.ongoing.meta2") },
        ]}
        onPress={() => onPick("ongoing")}
      />
      <ModeCard
        mode="in-person"
        title={t("shareSheet.inPerson.title")}
        subtitle={t("shareSheet.inPerson.subtitle")}
        meta={[
          { icon: Clock, label: t("shareSheet.inPerson.meta") },
          { icon: ScanLine, label: t("shareSheet.inPerson.meta2") },
        ]}
        onPress={() => onPick("in-person")}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
        }}
      >
        <Lock size={14} color={colors.textMuted} strokeWidth={2.25} />
        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
          {t("shareSheet.footer")}
        </Text>
      </View>
    </View>
  );
}

function ModeCard({
  mode,
  title,
  subtitle,
  meta,
  onPress,
  recommended,
}: {
  mode: Exclude<Mode, "pick">;
  title: string;
  subtitle: string;
  meta: { icon: LucideIcon; label: string }[];
  onPress: () => void;
  recommended?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, shadow } = useTheme();
  const { icon: Icon, tone } = MODE_META[mode];
  const pal = tonePalette(tone, colors);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: 22,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: recommended ? 1.5 : 1,
          borderColor: recommended ? pal.border : colors.hairline,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
        shadow?.xs,
      ]}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: "continuous",
          backgroundColor: pal.bg,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
        }}
      >
        <Icon size={24} color={pal.fg} strokeWidth={2.1} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={[typography.title.sm, { color: colors.text }]}>{title}</Text>
          {recommended ? (
            <Pill tone={tone} size="sm">
              {t("shareSheet.recommended")}
            </Pill>
          ) : null}
        </View>
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>{subtitle}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {meta.map((m) => (
            <View
              key={m.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.fill,
              }}
            >
              <m.icon size={11} color={colors.textSubtle} strokeWidth={2.4} />
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11.5 }]}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.well,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ─── Shared flow pieces ─────────────────────────────────────

function FlowIntro({
  mode,
  text,
  onBack,
}: {
  mode: Exclude<Mode, "pick">;
  text: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const { icon: Icon, tone } = MODE_META[mode];
  const pal = tonePalette(tone, colors);

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          paddingLeft: 6,
          paddingRight: 12,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.fill,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ChevronLeft size={16} color={colors.text} strokeWidth={2.5} />
        <Text style={[typography.label.md, { color: colors.text }]}>
          {t("shareSheet.back")}
        </Text>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: 18,
          borderCurve: "continuous",
          backgroundColor: pal.bg,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: pal.bgStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color={pal.onBgStrong} strokeWidth={2.25} />
        </View>
        <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{text}</Text>
      </View>
    </View>
  );
}

function OptionGroup<T extends string | number>({
  options,
  value,
  onChange,
  icons,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  icons?: Record<string, LucideIcon>;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const sel = o.value === value;
        const Icon = icons?.[String(o.value)];
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minWidth: 72,
              height: 42,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: sel ? colors.primarySoft : colors.fill,
              borderWidth: 1.5,
              borderColor: sel ? colors.primary : "transparent",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {Icon ? (
              <Icon size={15} color={sel ? colors.primary : colors.textMuted} strokeWidth={2.25} />
            ) : sel ? (
              <Check size={14} color={colors.primary} strokeWidth={3} />
            ) : null}
            <Text
              style={[typography.label.md, { color: sel ? colors.primary : colors.text }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ExpiryNote({ at }: { at: Date }) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 2 }}>
      <Clock size={13} color={colors.textSubtle} strokeWidth={2.25} />
      <Text style={[typography.caption, { color: colors.textSubtle }]}>
        {t("shareSheet.expiresOn", {
          date: at.toLocaleString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }),
        })}
      </Text>
    </View>
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
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const durationLabel = useDurationLabel();
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
        toast.show(t("shareSheet.visit.packCreated"), "success");
      } else {
        await createLink.mutateAsync({
          label: label.trim() || undefined,
          expiresInHours: hours,
          scope: "all",
          ...(recordId ? { recordId } : {}),
          ...(familyMemberId ? { familyMemberId } : {}),
        });
        toast.show(t("shareSheet.visit.linkCreated"), "success");
      }
      onDone();
    } catch (err) {
      toast.show((err as Error)?.message || t("shareSheet.failed"), "danger");
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <FlowIntro
        mode="visit"
        onBack={onBack}
        text={
          isPack
            ? t("shareSheet.visit.packIntro", { count: recordIds!.length })
            : t("shareSheet.visit.intro")
        }
      />

      <FormField label={t("shareSheet.expiresIn")}>
        <OptionGroup
          options={EXPIRY_HOURS.map((h) => ({ value: h, label: durationLabel(h) }))}
          value={hours}
          onChange={setHours}
        />
        <ExpiryNote at={new Date(Date.now() + hours * 3600_000)} />
      </FormField>

      <FormField label={t("shareSheet.label")} helper={t("shareSheet.labelHelper")}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          tone="soft"
          placeholder={t(isPack ? "shareSheet.visit.packPlaceholder" : "shareSheet.visit.placeholder")}
        />
      </FormField>

      <Button
        title={t(isPack ? "shareSheet.visit.createPack" : "shareSheet.visit.create")}
        icon={Link2}
        size="lg"
        onPress={submit}
        loading={pending}
      />
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
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const durationLabel = useDurationLabel();
  const [purpose, setPurpose] = useState<ConsentPurpose>(CONSENT_PURPOSES[0]);
  const [durationDays, setDurationDays] = useState<number>(() =>
    defaultDaysFor(CONSENT_PURPOSES[0]),
  );
  const [label, setLabel] = useState("");
  const issue = useIssueConsent();
  const toast = useToast();

  const maxDays = PURPOSE_REGISTRY[purpose]?.maxDays ?? 365;
  const dayOptions = DURATION_DAYS.filter((d) => d <= maxDays);

  const pickPurpose = (p: ConsentPurpose) => {
    setPurpose(p);
    setDurationDays(defaultDaysFor(p));
  };

  const submit = async () => {
    try {
      await issue.mutateAsync({
        purpose,
        durationDays,
        label: label.trim() || undefined,
        scope: { kinds: ["*"] },
      });
      toast.show(t("shareSheet.ongoing.issued"), "success");
      onDone();
    } catch (err) {
      toast.show((err as Error)?.message || t("shareSheet.failed"), "danger");
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <FlowIntro mode="ongoing" onBack={onBack} text={t("shareSheet.ongoing.intro")} />

      <FormField label={t("shareSheet.ongoing.purpose")}>
        <OptionGroup
          options={CONSENT_PURPOSES.map((p) => ({
            value: p,
            label: t(`consent.purpose.${p}`, p),
          }))}
          value={purpose}
          onChange={pickPurpose}
          icons={PURPOSE_ICONS}
        />
      </FormField>

      <FormField label={t("shareSheet.ongoing.duration")}>
        <OptionGroup
          options={dayOptions.map((d) => ({ value: d, label: durationLabel(d * 24) }))}
          value={durationDays}
          onChange={setDurationDays}
        />
        <ExpiryNote at={new Date(Date.now() + durationDays * 86_400_000)} />
      </FormField>

      <FormField label={t("shareSheet.label")} helper={t("shareSheet.labelHelper")}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          tone="soft"
          placeholder={t("shareSheet.ongoing.placeholder")}
        />
      </FormField>

      <Button
        title={t("shareSheet.ongoing.issue")}
        icon={ShieldCheck}
        size="lg"
        onPress={submit}
        loading={issue.isPending}
      />
    </View>
  );
}

function defaultDaysFor(purpose: ConsentPurpose): number {
  const def = PURPOSE_REGISTRY[purpose];
  const max = def?.maxDays ?? 365;
  const want = Math.min(def?.defaultDays || 1, max);
  // Snap to the nearest offered option that fits under the purpose cap.
  const opts = DURATION_DAYS.filter((d) => d <= max);
  return opts.reduce((best, d) => (Math.abs(d - want) < Math.abs(best - want) ? d : best), opts[0] ?? 1);
}

// ─── In-person flow (QR display) ───────────────────────────

function InPersonFlow({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, shadow } = useTheme();
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
    } catch (err) {
      toast.show((err as Error)?.message || t("shareSheet.failed"), "danger");
    }
  };

  if (token) {
    const expires = new Date(token.expiresAt);
    return (
      <View style={{ gap: spacing.lg, alignItems: "stretch" }}>
        <View
          style={[
            {
              alignItems: "center",
              padding: spacing.xl,
              borderRadius: 28,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.hairline,
              gap: spacing.md,
            },
            shadow?.card,
          ]}
        >
          <View
            style={{
              padding: 14,
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: "#FFFFFF",
            }}
          >
            <QRCode value={token.url} size={200} />
          </View>
          <Text style={[typography.title.sm, { color: colors.text, textAlign: "center" }]}>
            {t("shareSheet.inPerson.ready")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <Pill tone="accent2" icon={ScanLine}>
              {t("shareSheet.inPerson.scans", { count: token.maxScans })}
            </Pill>
            <Pill tone="neutral" icon={Clock}>
              {t("shareSheet.inPerson.until", {
                time: expires.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
              })}
            </Pill>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            title={t("shareSheet.inPerson.regenerate")}
            variant="outline"
            icon={RefreshCw}
            onPress={generate}
            loading={issue.isPending}
            style={{ flex: 1 }}
          />
          <Button title={t("shareSheet.done")} onPress={onDone} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  const steps = [
    t("shareSheet.inPerson.step1"),
    t("shareSheet.inPerson.step2"),
    t("shareSheet.inPerson.step3"),
  ];

  return (
    <View style={{ gap: spacing.lg }}>
      <FlowIntro mode="in-person" onBack={onBack} text={t("shareSheet.inPerson.intro")} />

      <View style={{ gap: spacing.md }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.fill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[typography.label.md, { color: colors.textMuted }]}>{i + 1}</Text>
            </View>
            <Text style={[typography.body.sm, { color: colors.text, flex: 1 }]}>{s}</Text>
          </View>
        ))}
      </View>

      <Button
        title={t("shareSheet.inPerson.generate")}
        icon={QrCode}
        size="lg"
        onPress={generate}
        loading={issue.isPending}
      />
    </View>
  );
}
