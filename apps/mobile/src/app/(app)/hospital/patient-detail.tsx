// @ts-nocheck

import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateTime, fmtDate } from "@/lib/format";
import {
  Bed,
  Droplet,
  Cake,
  Phone,
  HeartPulse,
  FileText,
  CheckCircle2,
  Activity,
} from "lucide-react-native";
import {
  useAdmittedPatient,
  useDischargeBed,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  SectionHeader,
  ListItem,
  Divider,
  Avatar,
  useToast,
} from "@/components/ui";

export default function HospitalPatientDetail() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useAdmittedPatient(id || null);
  const dischargeBed = useDischargeBed();

  if (!id) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title={t("hospitalPatientDetail.fallbackTitle")} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <EmptyState
            icon={FileText}
            title={t("hospitalPatientDetail.notFoundTitle")}
            message={t("hospitalPatientDetail.notFoundBody")}
            actionLabel={t("hospitalPatientDetail.goBack")}
            onAction={() => router.back()}
            tone="neutral"
          />
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title={t("hospitalPatientDetail.loadingTitle")} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={140} radius={24} />
          <Skeleton height={80} radius={20} />
          <Skeleton height={200} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen padded>
        <EmptyState
          icon={Bed}
          title={t("hospitalPatientDetail.notAdmittedTitle")}
          message={t("hospitalPatientDetail.notAdmittedBody")}
        />
      </Screen>
    );
  }

  const { admission, patient, user, records, vitals } = data;

  function confirmDischarge() {
    if (!admission) return;
    Alert.alert(
      t("hospitalPatientDetail.dischargeAlertTitle"),
      t("hospitalPatientDetail.dischargeAlertBody"),
      [
        { text: t("hospitalPatientDetail.cancel"), style: "cancel" },
        {
          text: t("hospitalPatientDetail.discharge"),
          style: "destructive",
          onPress: async () => {
            try {
              await dischargeBed.mutateAsync(admission.bedId);
              toast.show(t("hospitalPatientDetail.dischargedToast"), "success");
              router.back();
            } catch (err: any) {
              toast.show(err?.message || t("hospitalPatientDetail.dischargeError"), "danger");
            }
          },
        },
      ]
    );
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={user?.name || t("hospitalPatientDetail.fallbackTitle")}
        right={
          <Button
            title={t("hospitalPatientDetail.discharge")}
            icon={CheckCircle2}
            variant="danger"
            size="sm"
            fullWidth={false}
            onPress={confirmDischarge}
            loading={dischargeBed.isPending}
          />
        }
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Avatar
                name={user?.name}
                size="lg"
                tone="primary"
                ring
                source={user?.photo ? { uri: user.photo } : undefined}
              />
              <View style={{ flex: 1 }}>
                <Text style={[typography.title.md, { color: colors.text }]}>
                  {user?.name}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  {user?.nic || user?.phone || "—"}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                flexWrap: "wrap",
              }}
            >
              <PillCmp
                icon={Bed}
                label={`${admission.wardName} · ${admission.bedNumber}`}
                tone="primary"
                size="sm"
              />
              {patient?.bloodGroup ? (
                <PillCmp
                  icon={Droplet}
                  label={patient.bloodGroup}
                  tone="danger"
                  size="sm"
                />
              ) : null}
              {patient?.gender ? (
                <PillCmp
                  label={patient.gender}
                  tone="neutral"
                  size="sm"
                />
              ) : null}
              {patient?.dateOfBirth ? (
                <PillCmp
                  icon={Cake}
                  label={patient.dateOfBirth}
                  tone="neutral"
                  size="sm"
                />
              ) : null}
              {user?.phone ? (
                <PillCmp
                  icon={Phone}
                  label={user.phone}
                  tone="neutral"
                  size="sm"
                />
              ) : null}
            </View>

            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted },
              ]}
            >
              {t("hospitalPatientDetail.admittedAt", {
                datetime: fmtDateTime(new Date(admission.assignedAt), locale),
              })}
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title={t("hospitalPatientDetail.recentVitals")} />
          {vitals && vitals.length > 0 ? (
            vitals.slice(0, 10).map((v: any, idx: number) => (
              <View key={v.id}>
                {idx > 0 ? <Divider /> : null}
                <ListItem
                  icon={Activity}
                  iconTone="primary"
                  title={v.type.replace(/_/g, " ")}
                  subtitle={fmtDateTime(new Date(v.recordedAt), locale)}
                  pill={{
                    label: `${v.value}${v.secondaryValue ? `/${v.secondaryValue}` : ""} ${v.unit}`,
                    tone: "primary",
                  }}
                />
              </View>
            ))
          ) : (
            <EmptyState icon={HeartPulse} title={t("hospitalPatientDetail.noVitals")} />
          )}
        </Card>

        <Card>
          <SectionHeader title={t("hospitalPatientDetail.records")} />
          {records && records.length > 0 ? (
            records.slice(0, 20).map((r: any, idx: number) => (
              <View key={r.id}>
                {idx > 0 ? <Divider /> : null}
                <ListItem
                  icon={FileText}
                  iconTone="info"
                  title={r.title}
                  subtitle={`${r.recordType} · ${r.date}`}
                />
              </View>
            ))
          ) : (
            <EmptyState icon={FileText} title={t("hospitalPatientDetail.noRecords")} />
          )}
        </Card>
      </View>
    </Screen>
  );
}