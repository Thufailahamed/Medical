import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useAdmittedPatient(id || null);
  const dischargeBed = useDischargeBed();

  if (!id) {
    return (
      <Screen padded={false} edges={["top"]} bottomInset>
        <ScreenHeader back onBack={() => router.back()} title="Patient" />
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
            title="Patient not found"
            message="We couldn't load this patient. Go back and try again."
            actionLabel="Go back"
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
        <ScreenHeader back onBack={() => router.back()} title="Patient" />
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
          title="Not admitted"
          message="This patient is not currently admitted to your hospital."
        />
      </Screen>
    );
  }

  const { admission, patient, user, records, vitals } = data;

  function confirmDischarge() {
    if (!admission) return;
    Alert.alert("Discharge patient?", "Move the bed to cleaning status.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discharge",
        style: "destructive",
        onPress: async () => {
          try {
            await dischargeBed.mutateAsync(admission.bedId);
            toast.show("Patient discharged", "success");
            router.back();
          } catch (err: any) {
            toast.show(err?.message || "Discharge failed", "danger");
          }
        },
      },
    ]);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={user?.name || "Patient"}
        right={
          <Button
            title="Discharge"
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
              Admitted {new Date(admission.assignedAt).toLocaleString()}
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Recent vitals" />
          {vitals && vitals.length > 0 ? (
            vitals.slice(0, 10).map((v: any, idx: number) => (
              <View key={v.id}>
                {idx > 0 ? <Divider /> : null}
                <ListItem
                  icon={Activity}
                  iconTone="primary"
                  title={v.type.replace(/_/g, " ")}
                  subtitle={new Date(v.recordedAt).toLocaleString()}
                  pill={{
                    label: `${v.value}${v.secondaryValue ? `/${v.secondaryValue}` : ""} ${v.unit}`,
                    tone: "primary",
                  }}
                />
              </View>
            ))
          ) : (
            <EmptyState icon={HeartPulse} title="No vitals recorded" />
          )}
        </Card>

        <Card>
          <SectionHeader title="Records" />
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
            <EmptyState icon={FileText} title="No records yet" />
          )}
        </Card>
      </View>
    </Screen>
  );
}