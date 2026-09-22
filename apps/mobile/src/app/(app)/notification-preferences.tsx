// @ts-nocheck

import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Bell,
  Pill,
  CalendarCheck2,
  FlaskConical,
  FileSignature,
  Syringe,
  Shield,
  Building2,
  Siren,
  Sparkles,
  Save,
  BellRing,
  Smartphone,
  Lock,
  ShieldAlert,
  CheckCheck,
  RotateCcw,
  Video,
} from "lucide-react-native";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  useToast,
  Pill as PillCmp,
  Pressable,
} from "@/components/ui";

type Pref = { type: string; inApp: boolean; push: boolean };

type Category = "clinical" | "services" | "safety";

interface NotificationTypeConfig {
  key: string;
  category: Category;
  labelKey: string;
  descriptionKey: string;
  Icon: any;
  tone: Tone;
}

const CATEGORIES: Array<{ key: Category; title: string; subtitle: string }> = [
  {
    key: "clinical",
    title: "Clinical & Treatments",
    subtitle: "Appointments, medicines, prescriptions & lab alerts",
  },
  {
    key: "safety",
    title: "Critical & Emergency",
    subtitle: "Urgent health alerts, SOS & patient safety",
  },
  {
    key: "services",
    title: "Hospital & Services",
    subtitle: "Facility announcements, insurance claims & policies",
  },
];

const TYPES: NotificationTypeConfig[] = [
  {
    key: "appointment",
    category: "clinical",
    labelKey: "notificationPreferences.type.appointment.label",
    descriptionKey: "notificationPreferences.type.appointment.description",
    Icon: CalendarCheck2,
    tone: "primary",
  },
  {
    key: "medicine",
    category: "clinical",
    labelKey: "notificationPreferences.type.medicine.label",
    descriptionKey: "notificationPreferences.type.medicine.description",
    Icon: Pill,
    tone: "accent2",
  },
  {
    key: "lab_ready",
    category: "clinical",
    labelKey: "notificationPreferences.type.lab_ready.label",
    descriptionKey: "notificationPreferences.type.lab_ready.description",
    Icon: FlaskConical,
    tone: "warning",
  },
  {
    key: "prescription",
    category: "clinical",
    labelKey: "notificationPreferences.type.prescription.label",
    descriptionKey: "notificationPreferences.type.prescription.description",
    Icon: FileSignature,
    tone: "accent",
  },
  {
    key: "vaccination",
    category: "clinical",
    labelKey: "notificationPreferences.type.vaccination.label",
    descriptionKey: "notificationPreferences.type.vaccination.description",
    Icon: Syringe,
    tone: "info",
  },
  {
    key: "teleconsult",
    category: "clinical",
    labelKey: "notificationPreferences.type.teleconsult.label",
    descriptionKey: "notificationPreferences.type.teleconsult.description",
    Icon: Video,
    tone: "accent",
  },
  {
    key: "emergency",
    category: "safety",
    labelKey: "notificationPreferences.type.emergency.label",
    descriptionKey: "notificationPreferences.type.emergency.description",
    Icon: Siren,
    tone: "danger",
  },
  {
    key: "hospital",
    category: "services",
    labelKey: "notificationPreferences.type.hospital.label",
    descriptionKey: "notificationPreferences.type.hospital.description",
    Icon: Building2,
    tone: "neutral",
  },
  {
    key: "insurance",
    category: "services",
    labelKey: "notificationPreferences.type.insurance.label",
    descriptionKey: "notificationPreferences.type.insurance.description",
    Icon: Shield,
    tone: "primary",
  },
  {
    key: "general",
    category: "services",
    labelKey: "notificationPreferences.type.general.label",
    descriptionKey: "notificationPreferences.type.general.description",
    Icon: Sparkles,
    tone: "accent2",
  },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, scheme } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();
  const { data } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const serverPrefs: Pref[] = useMemo(() => {
    const list = (data?.preferences || []) as Pref[];
    return TYPES.map((item) => {
      const row = list.find((p) => p.type === item.key);
      return row ? { ...row } : { type: item.key, inApp: true, push: true };
    });
  }, [data]);

  const [local, setLocal] = useState<Pref[]>(serverPrefs);
  const [hasUserEdited, setHasUserEdited] = useState(false);

  // Synchronize when server data first loads if user hasn't edited yet
  useEffect(() => {
    if (!hasUserEdited && serverPrefs.length > 0) {
      setLocal(serverPrefs);
    }
  }, [serverPrefs, hasUserEdited]);

  const hasChanges = useMemo(() => {
    return local.some((l) => {
      const s = serverPrefs.find((sp) => sp.type === l.type);
      if (!s) return false;
      return s.inApp !== l.inApp || s.push !== l.push;
    });
  }, [local, serverPrefs]);

  function setPref(type: string, field: "inApp" | "push", value: boolean) {
    if (type === "emergency" && field === "inApp" && !value) return; // safety lock
    setHasUserEdited(true);
    setLocal((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [field]: value } : p))
    );
  }

  function applyPreset(mode: "all_on" | "clinical_only" | "reset") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHasUserEdited(true);

    if (mode === "reset") {
      setLocal(serverPrefs);
      setHasUserEdited(false);
      return;
    }

    if (mode === "all_on") {
      setLocal(
        TYPES.map((item) => ({
          type: item.key,
          inApp: true,
          push: true,
        }))
      );
      return;
    }

    if (mode === "clinical_only") {
      setLocal(
        TYPES.map((item) => {
          const isClinicalOrSafety = item.category === "clinical" || item.category === "safety";
          return {
            type: item.key,
            inApp: true,
            push: isClinicalOrSafety,
          };
        })
      );
    }
  }

  function handleDiscard() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLocal(serverPrefs);
    setHasUserEdited(false);
  }

  async function save() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await update.mutateAsync(local);
      setHasUserEdited(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.show(t("notificationPreferences.toast.saved", "Preferences saved"), "success");
    } catch (err: any) {
      toast.show(err?.message || t("notificationPreferences.toast.saveError", "Could not save"), "danger");
    }
  }

  const enabledCount = local.filter((p) => p.inApp || p.push).length;
  const pushCount = local.filter((p) => p.push).length;
  const inAppCount = local.filter((p) => p.inApp).length;

  const isAllOn = local.every((p) => p.inApp && p.push);
  const isClinicalOnly =
    local.every((p) => {
      const def = TYPES.find((t2) => t2.key === p.type);
      if (!def) return true;
      if (def.category === "services") return !p.push;
      return p.push && p.inApp;
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen scroll bottomInset>
        <ScreenHeader
          back
          onBack={() => router.back()}
          title={t("notificationPreferences.title", "Notifications")}
          subtitle={t("notificationPreferences.subtitle", {
            count: enabledCount,
            total: TYPES.length,
            defaultValue: `${enabledCount} of ${TYPES.length} active`,
          })}
        />

        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: hasChanges ? spacing.xl * 4 : spacing.xl * 2,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Overview & Quick Presets */}
          <LinearGradient
            colors={
              isDark
                ? [colors.surfaceElevated, colors.surface]
                : [colors.primarySoft, colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 22,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.md,
            }}
          >
            {/* Top Stat Row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <BellRing size={24} color={colors.onPrimary} />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[typography.title.md, { color: colors.text, fontWeight: "700" }]}>
                  Notification Channels
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {pushCount} push alerts · {inAppCount} in-app feeds active
                </Text>
              </View>
            </View>

            {/* Quick Action Presets Strip */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingTop: spacing.xs,
                borderTopWidth: 1,
                borderTopColor: colors.border + "60",
              }}
            >
              <PresetChip
                label="All On"
                icon={CheckCheck}
                active={isAllOn}
                onPress={() => applyPreset("all_on")}
              />
              <PresetChip
                label="Clinical Only"
                icon={Sparkles}
                active={isClinicalOnly && !isAllOn}
                onPress={() => applyPreset("clinical_only")}
              />
              <PresetChip
                label="Reset Defaults"
                icon={RotateCcw}
                active={false}
                onPress={() => applyPreset("reset")}
              />
            </View>
          </LinearGradient>

          {/* Grouped Category Sections */}
          {CATEGORIES.map((cat) => {
            const catItems = TYPES.filter((item) => item.category === cat.key);
            if (!catItems.length) return null;

            return (
              <View key={cat.key} style={{ gap: spacing.sm }}>
                {/* Category Header */}
                <View style={{ paddingHorizontal: spacing.xs, gap: 2 }}>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700", letterSpacing: -0.2 },
                    ]}
                  >
                    {cat.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {cat.subtitle}
                  </Text>
                </View>

                {/* Cards in Category */}
                <View style={{ gap: spacing.sm }}>
                  {catItems.map((item) => {
                    const pref = local.find((p) => p.type === item.key) || {
                      type: item.key,
                      inApp: true,
                      push: true,
                    };
                    return (
                      <NotificationSettingCard
                        key={item.key}
                        item={item}
                        pref={pref}
                        onChangeChannel={(field, val) => setPref(item.key, field, val)}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Bottom Secondary Actions */}
          <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.sm }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                applyPreset("reset");
              }}
              style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}
            >
              <Text
                style={[
                  typography.label.md,
                  { color: colors.textMuted, textAlign: "center" },
                ]}
              >
                {t("notificationPreferences.reset", "Reset all to defaults")}
              </Text>
            </Pressable>

            {!hasChanges && (
              <Button
                title={t("common.save", "Save preferences")}
                icon={Save}
                onPress={save}
                variant="outline"
                loading={update.isPending}
                fullWidth
              />
            )}
          </View>
        </ScrollView>
      </Screen>

      {/* Floating Sticky Save Bar when dirty */}
      {hasChanges && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.warning,
                }}
              />
              <Text style={[typography.label.md, { color: colors.text, fontWeight: "700" }]}>
                Unsaved changes
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
              Tap save to update alerts
            </Text>
          </View>

          <Button
            variant="ghost"
            size="sm"
            title="Discard"
            onPress={handleDiscard}
          />

          <Button
            variant="primary"
            size="sm"
            title={t("common.save", "Save")}
            icon={Save}
            loading={update.isPending}
            onPress={save}
          />
        </View>
      )}
    </View>
  );
}

function PresetChip({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: any;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Icon size={13} color={active ? colors.onPrimary : colors.textMuted} strokeWidth={2} />
      <Text
        style={[
          typography.label.sm,
          {
            color: active ? colors.onPrimary : colors.text,
            fontWeight: active ? "700" : "500",
            fontSize: 12,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NotificationSettingCard({
  item,
  pref,
  onChangeChannel,
}: {
  item: NotificationTypeConfig;
  pref: Pref;
  onChangeChannel: (field: "inApp" | "push", value: boolean) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const palette = useTone(item.tone);
  const isEmergency = item.key === "emergency";
  const Icon = item.Icon;

  // Active status text & pill
  let statusText = "Muted";
  let statusTone: Tone = "neutral";
  if (isEmergency) {
    statusText = "Always Active";
    statusTone = "danger";
  } else if (pref.inApp && pref.push) {
    statusText = "Push & In-App";
    statusTone = "primary";
  } else if (pref.push) {
    statusText = "Push only";
    statusTone = "info";
  } else if (pref.inApp) {
    statusText = "In-App only";
    statusTone = "neutral";
  }

  return (
    <Card
      style={{
        padding: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isEmergency ? colors.dangerSoft : colors.border,
        gap: spacing.sm,
      }}
    >
      {/* Top Header Row */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        {/* Soft Icon Badge */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: palette.border + "30",
          }}
        >
          <Icon size={22} color={palette.fg} strokeWidth={2.2} />
        </View>

        {/* Title + Subtitle */}
        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
            }}
          >
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, flex: 1, fontWeight: "600" },
              ]}
              numberOfLines={1}
            >
              {t(item.labelKey)}
            </Text>
            <PillCmp label={statusText} tone={statusTone} size="sm" />
          </View>
          <Text
            style={[typography.caption, { color: colors.textMuted, lineHeight: 17 }]}
          >
            {t(item.descriptionKey)}
          </Text>
        </View>
      </View>

      {/* Segmented Channel Control Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surfaceSubtle,
          borderRadius: 14,
          padding: 4,
          marginTop: spacing.xs,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {/* In-App Channel Segment */}
        <Pressable
          onPress={() => {
            if (isEmergency) return;
            Haptics.selectionAsync().catch(() => {});
            onChangeChannel("inApp", !pref.inApp);
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 7,
            paddingHorizontal: spacing.sm,
            borderRadius: 10,
            backgroundColor: pref.inApp ? colors.surface : "transparent",
            borderWidth: pref.inApp ? 1 : 0,
            borderColor: colors.border,
            opacity: isEmergency ? 0.75 : 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            {isEmergency ? (
              <Lock size={14} color={colors.danger} />
            ) : (
              <Bell size={14} color={pref.inApp ? colors.primary : colors.textMuted} />
            )}
            <Text
              style={[
                typography.label.sm,
                {
                  color: isEmergency
                    ? colors.danger
                    : pref.inApp
                    ? colors.text
                    : colors.textMuted,
                  fontWeight: pref.inApp ? "600" : "500",
                },
              ]}
              numberOfLines={1}
            >
              {t("notificationPreferences.toggle.inApp", "In-app")}
            </Text>
          </View>
          <Switch
            value={pref.inApp}
            onValueChange={(v) => {
              if (isEmergency) return;
              Haptics.selectionAsync().catch(() => {});
              onChangeChannel("inApp", v);
            }}
            disabled={isEmergency}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={pref.inApp ? colors.onPrimary : colors.surface}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }], marginRight: -4 }}
          />
        </Pressable>

        {/* Subtle Divider */}
        <View
          style={{
            width: 1,
            height: 22,
            backgroundColor: colors.border,
            marginHorizontal: 2,
          }}
        />

        {/* Push Channel Segment */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChangeChannel("push", !pref.push);
          }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 7,
            paddingHorizontal: spacing.sm,
            borderRadius: 10,
            backgroundColor: pref.push ? colors.surface : "transparent",
            borderWidth: pref.push ? 1 : 0,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <Smartphone size={14} color={pref.push ? colors.primary : colors.textMuted} />
            <Text
              style={[
                typography.label.sm,
                {
                  color: pref.push ? colors.text : colors.textMuted,
                  fontWeight: pref.push ? "600" : "500",
                },
              ]}
              numberOfLines={1}
            >
              {t("notificationPreferences.toggle.push", "Push")}
            </Text>
          </View>
          <Switch
            value={pref.push}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              onChangeChannel("push", v);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={pref.push ? colors.onPrimary : colors.surface}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }], marginRight: -4 }}
          />
        </Pressable>
      </View>

      {/* Safety Notice for Emergency */}
      {isEmergency && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: spacing.xs,
            paddingTop: 2,
          }}
        >
          <ShieldAlert size={12} color={colors.danger} />
          <Text
            style={[
              typography.caption,
              { color: colors.danger, fontSize: 11, flex: 1, fontWeight: "500" },
            ]}
          >
            In-app emergency notifications remain locked on for patient safety.
          </Text>
        </View>
      )}
    </Card>
  );
}