// @ts-nocheck

import { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  Divider,
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
  const { spacing, colors, typography, scheme, shadow, radius } = useTheme();
  const isDark = scheme === "dark";
  const toast = useToast();
  const insets = useSafeAreaInsets();
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
    !isAllOn &&
    local.every((p) => {
      const def = TYPES.find((t2) => t2.key === p.type);
      if (!def) return true;
      if (def.category === "services") return p.inApp && !p.push;
      return p.push && p.inApp;
    });
  const mode = isAllOn ? "all" : isClinicalOnly ? "essentials" : "custom";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen padded={false} edges={["top"]} bottomInset={false}>
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
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            gap: spacing.lg,
            paddingBottom: (hasChanges ? 110 : spacing.xl) + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Overview + mode picker */}
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.card,
              borderCurve: "continuous",
              padding: spacing.lg,
              gap: spacing.lg,
              overflow: "hidden",
              ...(isDark ? null : shadow.hero),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(255,255,255,0.28)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BellRing size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, flexDirection: "row", gap: spacing.lg }}>
                <HeroCount icon={Smartphone} value={pushCount} label={t("notificationPreferences.hero.push", "Push")} />
                <HeroCount icon={Bell} value={inAppCount} label={t("notificationPreferences.hero.inApp", "In-app")} />
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                padding: 4,
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.14)",
              }}
            >
              {[
                { key: "all", label: t("notificationPreferences.mode.all", "Everything"), icon: CheckCheck, onPress: () => applyPreset("all_on") },
                { key: "essentials", label: t("notificationPreferences.mode.essentials", "Essentials"), icon: ShieldAlert, onPress: () => applyPreset("clinical_only") },
                { key: "custom", label: t("notificationPreferences.mode.custom", "Custom"), icon: Sparkles, onPress: undefined },
              ].map((m) => {
                const on = mode === m.key;
                const MIcon = m.icon;
                return (
                  <Pressable
                    key={m.key}
                    onPress={m.onPress}
                    disabled={!m.onPress}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: !m.onPress }}
                    style={{
                      flex: 1,
                      height: 36,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      borderRadius: 999,
                      backgroundColor: on ? "#FFFFFF" : "transparent",
                    }}
                  >
                    <MIcon size={13} color={on ? colors.primaryGradientEnd : "rgba(255,255,255,0.9)"} strokeWidth={2.4} />
                    <Text
                      numberOfLines={1}
                      style={[typography.label.sm, { color: on ? colors.primaryGradientEnd : "#FFFFFF" }]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)", marginTop: -spacing.sm }]}>
              {mode === "all"
                ? t("notificationPreferences.mode.allHelp", "Every alert as a push notification and in the app.")
                : mode === "essentials"
                ? t("notificationPreferences.mode.essentialsHelp", "Push only for care & safety; hospital and insurance news stays in the app.")
                : t("notificationPreferences.mode.customHelp", "Your own mix — fine-tune each type below.")}
            </Text>
          </LinearGradient>

          {/* Grouped category sections */}
          {CATEGORIES.map((cat) => {
            const catItems = TYPES.filter((item) => item.category === cat.key);
            if (!catItems.length) return null;

            return (
              <View key={cat.key} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 2 }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[typography.title.md, { color: colors.text }]}>
                      {t(`notificationPreferences.category.${cat.key}.title`, cat.title)}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSubtle }]}>
                      {t(`notificationPreferences.category.${cat.key}.subtitle`, cat.subtitle)}
                    </Text>
                  </View>
                  {/* Column legend aligned with the toggle buttons in each row */}
                  <View style={{ flexDirection: "row", gap: 8, paddingRight: spacing.lg - 2 }}>
                    {[t("notificationPreferences.toggle.inApp", "In-app"), t("notificationPreferences.toggle.push", "Push")].map((l) => (
                      <Text
                        key={l}
                        numberOfLines={1}
                        style={[typography.label.xs, { width: 40, textAlign: "center", color: colors.textSubtle, letterSpacing: 0 }]}
                      >
                        {l}
                      </Text>
                    ))}
                  </View>
                </View>

                <Card padded={false} style={{ overflow: "hidden" }}>
                  {catItems.map((item, i) => {
                    const pref = local.find((p) => p.type === item.key) || {
                      type: item.key,
                      inApp: true,
                      push: true,
                    };
                    return (
                      <View key={item.key}>
                        {i > 0 ? <Divider inset={spacing.lg + 40 + spacing.md} /> : null}
                        <NotificationRow
                          item={item}
                          pref={pref}
                          onChangeChannel={(field, val) => setPref(item.key, field, val)}
                        />
                      </View>
                    );
                  })}
                </Card>
              </View>
            );
          })}
        </ScrollView>
      </Screen>

      {/* Sticky save bar only while there are unsaved edits */}
      {hasChanges && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            backgroundColor: isDark ? colors.bgElevated : colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.separator,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
            <Text style={[typography.label.md, { color: colors.text }]} numberOfLines={1}>
              {t("notificationPreferences.unsaved", "Unsaved changes")}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            fullWidth={false}
            title={t("notificationPreferences.discard", "Discard")}
            onPress={handleDiscard}
          />
          <Button
            variant="primary"
            size="sm"
            fullWidth={false}
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

function HeroCount({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  const { typography } = useTheme();
  return (
    <View>
      <Text style={[typography.title.lg, { color: "#FFFFFF", fontVariant: ["tabular-nums"] }]}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon size={11} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
        <Text style={[typography.caption, { color: "rgba(255,255,255,0.85)" }]}>{label}</Text>
      </View>
    </View>
  );
}

/** Round icon toggle — two of these replace a pair of full-width switch bars. */
function ChannelToggle({
  icon: Icon,
  on,
  locked,
  onPress,
  label,
}: {
  icon: any;
  on: boolean;
  locked?: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const danger = useTone("danger");
  return (
    <Pressable
      onPress={() => {
        if (locked) return;
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={locked}
      hitSlop={4}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: !!locked }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: locked ? danger.bg : on ? colors.primary : colors.fill,
        borderWidth: on || locked ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      {locked ? (
        <Lock size={16} color={danger.fg} strokeWidth={2.4} />
      ) : (
        <Icon size={17} color={on ? colors.onPrimary : colors.textSubtle} strokeWidth={2.3} />
      )}
    </Pressable>
  );
}

function NotificationRow({
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
  const label = t(item.labelKey);
  const muted = !pref.inApp && !pref.push;

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: palette.bg,
            alignItems: "center",
            justifyContent: "center",
            opacity: muted ? 0.5 : 1,
          }}
        >
          <Icon size={20} color={palette.fg} strokeWidth={2.2} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={[typography.title.sm, { color: muted ? colors.textMuted : colors.text }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {muted ? t("notificationPreferences.mutedLabel", "Muted") : t(item.descriptionKey)}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <ChannelToggle
            icon={Bell}
            on={pref.inApp}
            locked={isEmergency}
            onPress={() => onChangeChannel("inApp", !pref.inApp)}
            label={`${label}: ${t("notificationPreferences.toggle.inApp", "In-app")}`}
          />
          <ChannelToggle
            icon={Smartphone}
            on={pref.push}
            onPress={() => onChangeChannel("push", !pref.push)}
            label={`${label}: ${t("notificationPreferences.toggle.push", "Push")}`}
          />
        </View>
      </View>

      {isEmergency && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginLeft: 40 + spacing.md,
          }}
        >
          <ShieldAlert size={12} color={colors.danger} />
          <Text style={[typography.caption, { color: colors.danger, flex: 1 }]}>
            {t("notificationPreferences.emergencyLocked", "In-app emergency alerts stay on for your safety.")}
          </Text>
        </View>
      )}
    </View>
  );
}
