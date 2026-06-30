import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
} from "lucide-react-native";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  useToast,
  Pill as PillCmp,
} from "@/components/ui";

type Pref = { type: string; inApp: boolean; push: boolean };

const TYPES: Array<{
  key: string;
  labelKey: string;
  descriptionKey: string;
  Icon: any;
}> = [
  {
    key: "appointment",
    labelKey: "notificationPreferences.type.appointment.label",
    descriptionKey: "notificationPreferences.type.appointment.description",
    Icon: CalendarCheck2,
  },
  {
    key: "medicine",
    labelKey: "notificationPreferences.type.medicine.label",
    descriptionKey: "notificationPreferences.type.medicine.description",
    Icon: Pill,
  },
  {
    key: "lab_ready",
    labelKey: "notificationPreferences.type.lab_ready.label",
    descriptionKey: "notificationPreferences.type.lab_ready.description",
    Icon: FlaskConical,
  },
  {
    key: "prescription",
    labelKey: "notificationPreferences.type.prescription.label",
    descriptionKey: "notificationPreferences.type.prescription.description",
    Icon: FileSignature,
  },
  {
    key: "vaccination",
    labelKey: "notificationPreferences.type.vaccination.label",
    descriptionKey: "notificationPreferences.type.vaccination.description",
    Icon: Syringe,
  },
  {
    key: "insurance",
    labelKey: "notificationPreferences.type.insurance.label",
    descriptionKey: "notificationPreferences.type.insurance.description",
    Icon: Shield,
  },
  {
    key: "hospital",
    labelKey: "notificationPreferences.type.hospital.label",
    descriptionKey: "notificationPreferences.type.hospital.description",
    Icon: Building2,
  },
  {
    key: "emergency",
    labelKey: "notificationPreferences.type.emergency.label",
    descriptionKey: "notificationPreferences.type.emergency.description",
    Icon: Siren,
  },
  {
    key: "general",
    labelKey: "notificationPreferences.type.general.label",
    descriptionKey: "notificationPreferences.type.general.description",
    Icon: Sparkles,
  },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const serverPrefs: Pref[] = useMemo(() => {
    const list = (data?.preferences || []) as Pref[];
    return TYPES.map((t) => {
      const row = list.find((p) => p.type === t.key);
      return row || { type: t.key, inApp: true, push: true };
    });
  }, [data]);

  const [local, setLocal] = useState<Pref[]>(serverPrefs);

  // Keep local in sync when server data first arrives.
  if (
    serverPrefs.length === local.length &&
    serverPrefs.some((s, i) => s.type !== local[i]?.type)
  ) {
    setLocal(serverPrefs);
  }

  function setPref(type: string, field: "inApp" | "push", value: boolean) {
    if (type === "emergency" && field === "inApp" && !value) return; // cannot disable
    setLocal((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [field]: value } : p))
    );
  }

  async function save() {
    try {
      await update.mutateAsync(local);
      toast.show(t("notificationPreferences.toast.saved"), "success");
    } catch (err: any) {
      toast.show(err?.message || t("notificationPreferences.toast.saveError"), "danger");
    }
  }

  const enabledCount = local.filter((p) => p.inApp || p.push).length;
  const pushOnly = local.filter((p) => p.push && p.inApp).length;

  return (
    <Screen scroll bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("notificationPreferences.title")}
        subtitle={t("notificationPreferences.subtitle", {
          count: enabledCount,
          total: TYPES.length,
        })}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xl * 2,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: 14,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Bell size={18} color={colors.primary} />
          <Text
            style={[
              typography.body.sm,
              { color: colors.text, flex: 1 },
            ]}
          >
            {t("notificationPreferences.banner.info", { count: pushOnly })}
          </Text>
        </View>

        {TYPES.map((t2) => {
          const pref = local.find((p) => p.type === t2.key) || {
            type: t2.key,
            inApp: true,
            push: true,
          };
          const emergencyOff = t2.key === "emergency";
          const Icon = t2.Icon;
          return (
            <Card key={t2.key}>
              <View style={{ gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Icon size={18} color={colors.primary} />
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, flex: 1 },
                    ]}
                  >
                    {t(t2.labelKey)}
                  </Text>
                  {emergencyOff ? (
                    <PillCmp
                      label={t("notificationPreferences.alwaysOn")}
                      tone="warning"
                      size="sm"
                    />
                  ) : null}
                </View>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {t(t2.descriptionKey)}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    marginTop: spacing.xs,
                  }}
                >
                  <ToggleRow
                    labelKey="notificationPreferences.toggle.inApp"
                    value={pref.inApp}
                    disabled={emergencyOff}
                    onChange={(v) => setPref(t2.key, "inApp", v)}
                  />
                  <ToggleRow
                    labelKey="notificationPreferences.toggle.push"
                    value={pref.push}
                    onChange={(v) => setPref(t2.key, "push", v)}
                  />
                </View>
              </View>
            </Card>
          );
        })}

        <Pressable
          onPress={() => {
            // Reset all
            setLocal(
              TYPES.map((t2) => ({ type: t2.key, inApp: true, push: true }))
            );
          }}
        >
          <Text
            style={[
              typography.label.md,
              { color: colors.primary, textAlign: "center" },
            ]}
          >
            {t("notificationPreferences.reset")}
          </Text>
        </Pressable>

        <Button
          title={t("common.save")}
          icon={Save}
          onPress={save}
          loading={update.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({
  labelKey,
  value,
  onChange,
  disabled,
}: {
  labelKey: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        backgroundColor: disabled ? colors.surface : colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text style={[typography.label.md, { color: colors.text }]}>
        {t(labelKey)}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.surface}
      />
    </View>
  );
}