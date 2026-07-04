import { useState } from "react";
import {
  View,
  Text,
  Alert,
  Pressable,
  ScrollView,
  Share,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Stethoscope,
  Plus,
  Link2,
  Pause,
  Play,
  XCircle,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  useCareTeam,
  useUpdateCareTeamMember,
  useCreateCareTeamInvite,
  usePatientProfile,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  Pill,
  useToast,
  Skeleton,
} from "@/components/ui";
import type { PillTone } from "@/components/ui/Pill";

const ROLE_TONE: Record<string, PillTone> = {
  primary_care: "success",
  specialist: "primary",
  covering: "warning",
  on_call: "info",
  family_view: "danger",
};

export default function CareTeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: profileData } = usePatientProfile();
  const patientId: string | null =
    profileData?.patient?.patients?.id ?? null;
  const { data, isLoading } = useCareTeam(patientId);
  const updateMember = useUpdateCareTeamMember();
  const createInvite = useCreateCareTeamInvite();
  const toast = useToast();
  const [issuingInvite, setIssuingInvite] = useState(false);

  const members: any[] = data?.members ?? [];

  const onTogglePause = async (m: any) => {
    const next = m.status === "active" ? "paused" : "active";
    try {
      await updateMember.mutateAsync({ id: m.id, status: next });
      toast.show(t("careTeam.statusChanged", { status: next }), "success");
    } catch (e: any) {
      toast.show(e?.message ?? "Failed", "danger");
    }
  };

  const onRevoke = (m: any) => {
    Alert.alert(
      t("careTeam.revokeTitle"),
      t("careTeam.revokeBody", { name: m.doctorName }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("careTeam.revoke"),
          style: "destructive",
          onPress: async () => {
            try {
              await updateMember.mutateAsync({ id: m.id, status: "revoked" });
              toast.show(t("careTeam.revoked"), "success");
            } catch (e: any) {
              toast.show(e?.message ?? "Failed", "danger");
            }
          },
        },
      ]
    );
  };

  const onIssueInvite = async () => {
    setIssuingInvite(true);
    try {
      const inv = await createInvite.mutateAsync({
        role: "primary_care",
        scope: "full",
        ttlHours: 24 * 7,
      });
      const url = `healthhub://join?token=${inv.token}`;
      try {
        await Share.share({
          message: `${t("careTeam.inviteMessage", {
            name: inv.patientName ?? "Patient",
          })}\n${url}`,
        });
      } catch {
        toast.show(`${t("careTeam.inviteToken")}: ${inv.token}`, "info");
      }
    } catch (e: any) {
      toast.show(e?.message ?? "Failed to create invite", "danger");
    } finally {
      setIssuingInvite(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("careTeam.title")}
        subtitle={t("careTeam.subtitle")}
        right={
          <Pressable
            onPress={() => router.push("/(app)/care-team-add")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("careTeam.add")}
          >
            <Plus size={26} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
            {t("careTeam.inviteHelp")}
          </Text>
          <Button
            title={issuingInvite ? t("careTeam.issuing") : t("careTeam.issueInvite")}
            onPress={onIssueInvite}
            loading={issuingInvite}
            variant="secondary"
            icon={Link2}
          />
        </Card>

        {isLoading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={t("careTeam.emptyTitle")}
            message={t("careTeam.emptyBody")}
            actionLabel={t("careTeam.add")}
            onAction={() => router.push("/(app)/care-team-add")}
          />
        ) : (
          members.map((m) => (
            <Card key={m.id} style={{ marginHorizontal: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                    {m.doctorName}
                  </Text>
                  {m.doctorSpecialization ? (
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                      {m.doctorSpecialization}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    <Pill
                      label={t(`careTeam.role.${m.role}`)}
                      tone={ROLE_TONE[m.role] ?? "primary"}
                    />
                    <Pill label={t(`careTeam.scope.${m.scope}`)} tone="neutral" />
                    {m.status !== "active" && (
                      <Pill
                        label={t(`careTeam.status.${m.status}`)}
                        tone={m.status === "paused" ? "warning" : "neutral"}
                      />
                    )}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  title={
                    m.status === "active"
                      ? t("careTeam.pause")
                      : t("careTeam.resume")
                  }
                  icon={m.status === "active" ? Pause : Play}
                  onPress={() => onTogglePause(m)}
                />
                {m.status !== "revoked" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title={t("careTeam.revoke")}
                    icon={XCircle}
                    onPress={() => onRevoke(m)}
                  />
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}