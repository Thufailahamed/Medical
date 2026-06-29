import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
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
  label: string;
  description: string;
  Icon: any;
}> = [
  {
    key: "appointment",
    label: "Appointments",
    description: "Booking, reschedule, confirmation, reminders",
    Icon: CalendarCheck2,
  },
  {
    key: "medicine",
    label: "Medicines",
    description: "Reminders, refills, adherence nudges",
    Icon: Pill,
  },
  {
    key: "lab_ready",
    label: "Lab results",
    description: "When lab reports are ready to view",
    Icon: FlaskConical,
  },
  {
    key: "prescription",
    label: "Prescriptions",
    description: "New prescriptions from your doctor",
    Icon: FileSignature,
  },
  {
    key: "vaccination",
    label: "Vaccinations",
    description: "Immunization schedule alerts",
    Icon: Syringe,
  },
  {
    key: "insurance",
    label: "Insurance",
    description: "Claims, expiry, updates",
    Icon: Shield,
  },
  {
    key: "hospital",
    label: "Hospital",
    description: "Admissions, bed updates, walk-ins",
    Icon: Building2,
  },
  {
    key: "emergency",
    label: "Emergency",
    description: "Always-on SOS, alerts (push only, cannot disable)",
    Icon: Siren,
  },
  {
    key: "general",
    label: "General",
    description: "Product updates, tips, announcements",
    Icon: Sparkles,
  },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
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
      toast.show("Preferences saved", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not save", "danger");
    }
  }

  const enabledCount = local.filter((p) => p.inApp || p.push).length;
  const pushOnly = local.filter((p) => p.push && p.inApp).length;

  return (
    <Screen scroll bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Notifications"
        subtitle={`${enabledCount} of ${TYPES.length} active`}
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
            {pushOnly} types send push notifications. In-app stays enabled unless
            you turn it off.
          </Text>
        </View>

        {TYPES.map((t) => {
          const pref = local.find((p) => p.type === t.key) || {
            type: t.key,
            inApp: true,
            push: true,
          };
          const emergencyOff = t.key === "emergency";
          return (
            <Card key={t.key}>
              <View style={{ gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <t.Icon size={18} color={colors.primary} />
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, flex: 1 },
                    ]}
                  >
                    {t.label}
                  </Text>
                  {emergencyOff ? (
                    <PillCmp label="always on" tone="warning" size="sm" />
                  ) : null}
                </View>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {t.description}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    marginTop: spacing.xs,
                  }}
                >
                  <ToggleRow
                    label="In-app"
                    value={pref.inApp}
                    disabled={emergencyOff}
                    onChange={(v) => setPref(t.key, "inApp", v)}
                  />
                  <ToggleRow
                    label="Push"
                    value={pref.push}
                    onChange={(v) => setPref(t.key, "push", v)}
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
              TYPES.map((t) => ({ type: t.key, inApp: true, push: true }))
            );
          }}
        >
          <Text
            style={[
              typography.label.md,
              { color: colors.primary, textAlign: "center" },
            ]}
          >
            Reset all to defaults
          </Text>
        </Pressable>

        <Button
          title="Save"
          icon={Save}
          onPress={save}
          loading={update.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
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
      <Text style={[typography.label.md, { color: colors.text }]}>{label}</Text>
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
