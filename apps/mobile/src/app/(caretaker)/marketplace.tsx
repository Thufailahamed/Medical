// @ts-nocheck
// Caretaker Profiles: Marketplace — caretaker's own listing manager.
//
// Gated on `users.verified=true`. Form for bio / languages / care
// roles / district / hourly rate / experience. Below the form:
// incoming inquiries with accept / decline actions.

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BadgeCheck, ShieldUser } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  Button,
  FormField,
  TextInput,
  Pill,
  Avatar,
  useToast,
  SectionHeader,
} from "@/components/ui";
import {
  useMyMarketplaceProfile,
  useUpsertMarketplaceProfile,
  useMyMarketplaceInquiries,
  useAcceptMarketplaceInquiry,
  useDeclineMarketplaceInquiry,
  type CareRole,
} from "@/hooks/useCaretakerMarketplace";

const ROLE_OPTIONS: CareRole[] = [
  "nurse",
  "caregiver",
  "home_aide",
  "companion",
];

const LANGUAGE_OPTIONS = ["en", "si", "ta"];

export default function CaretakerMarketplaceScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const profile = useMyMarketplaceProfile();
  const save = useUpsertMarketplaceProfile();
  const inquiries = useMyMarketplaceInquiries();
  const accept = useAcceptMarketplaceInquiry();
  const decline = useDeclineMarketplaceInquiry();

  const v = profile.data;
  const isVerified = v?.verified === true;
  const p = v?.profile;

  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [roles, setRoles] = useState<CareRole[]>([]);
  const [district, setDistrict] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [isAvailable, setIsAvailable] = useState(true);

  // Reset form when server-side profile arrives.
  useEffect(() => {
    if (!p) return;
    setBio(p.bio ?? "");
    setLanguages(p.languages ?? []);
    setRoles(p.careRolesOffered ?? []);
    setDistrict(p.district ?? "");
    setHourlyRate(p.hourlyRateLkr ? String(p.hourlyRateLkr) : "");
    setExperienceYears(String(p.experienceYears ?? 0));
    setIsAvailable(p.isAvailable ?? true);
  }, [p?.id, p?.updatedAt]);

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function handleSave() {
    if (!district.trim()) {
      toast.show(t("marketplace.listing.district") + " required", "danger");
      return;
    }
    if (roles.length === 0) {
      toast.show(t("marketplace.listing.roles") + " required", "danger");
      return;
    }
    const rateNum = hourlyRate ? parseInt(hourlyRate, 10) : null;
    if (rateNum !== null && (isNaN(rateNum) || rateNum < 0)) {
      toast.show(t("marketplace.listing.rate"), "danger");
      return;
    }
    try {
      await save.mutateAsync({
        bio,
        languages,
        careRolesOffered: roles,
        district: district.trim(),
        hourlyRateLkr: rateNum,
        experienceYears: parseInt(experienceYears, 10) || 0,
        isAvailable,
      });
      toast.show(t("marketplace.listing.saved"), "success");
    } catch {
      toast.show(t("marketplace.listing.failed"), "danger");
    }
  }

  function confirmAccept(id: string) {
    Alert.alert(
      t("marketplace.listing.acceptConfirm"),
      "",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("marketplace.listing.accept"),
          onPress: () =>
            accept.mutate(id, {
              onSuccess: () =>
                toast.show(t("marketplace.listing.accepted"), "success"),
              onError: () => toast.show(t("common.error"), "danger"),
            }),
        },
      ]
    );
  }

  function confirmDecline(id: string) {
    Alert.alert(
      t("marketplace.listing.declineConfirm"),
      "",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("marketplace.listing.decline"),
          style: "destructive",
          onPress: () =>
            decline.mutate(id, {
              onSuccess: () =>
                toast.show(t("marketplace.listing.declined"), "info"),
            }),
        },
      ]
    );
  }

  const incoming = inquiries.data?.inquiries ?? [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("marketplace.listing.title")} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={profile.isFetching || inquiries.isFetching}
            onRefresh={() => {
              profile.refetch();
              inquiries.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ─── Verified gate banner ─── */}
        {!isVerified ? (
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <ShieldUser size={18} color={colors.warning} />
              <Text
                style={{
                  ...typography.body,
                  color: colors.text,
                  flex: 1,
                }}
              >
                {t("marketplace.listing.notVerified")}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* ─── Availability toggle ─── */}
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>
              {t("marketplace.listing.available")}
            </Text>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              disabled={!isVerified}
            />
          </View>
        </Card>

        {/* ─── Form ─── */}
        {isVerified ? (
          <>
            <Card>
              <FormField label={t("marketplace.listing.bio")}>
                <TextInput
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  value={bio}
                  onChangeText={setBio}
                />
              </FormField>
            </Card>

            <Card>
              <FormField label={t("marketplace.listing.languages")}>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                  }}
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <Chip
                      key={l}
                      label={l}
                      selected={languages.includes(l)}
                      onPress={() =>
                        setLanguages((prev) => toggle(prev, l))
                      }
                    />
                  ))}
                </View>
              </FormField>
            </Card>

            <Card>
              <FormField label={t("marketplace.listing.roles")}>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                  }}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <Chip
                      key={r}
                      label={t(`caretaker.role.${r}`)}
                      selected={roles.includes(r)}
                      onPress={() => setRoles((prev) => toggle(prev, r))}
                    />
                  ))}
                </View>
              </FormField>
            </Card>

            <Card>
              <FormField label={t("marketplace.listing.district")}>
                <TextInput value={district} onChangeText={setDistrict} />
              </FormField>
              <FormField
                label={t("marketplace.listing.rate")}
                helper={t("marketplace.listing.rateOptional")}
                style={{ marginTop: spacing.md }}
              >
                <TextInput
                  keyboardType="numeric"
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  placeholder="e.g. 2500"
                />
              </FormField>
              <FormField
                label={t("marketplace.listing.experience")}
                style={{ marginTop: spacing.md }}
              >
                <TextInput
                  keyboardType="numeric"
                  value={experienceYears}
                  onChangeText={setExperienceYears}
                />
              </FormField>
            </Card>

            <Button
              label={
                save.isPending
                  ? t("marketplace.listing.saving")
                  : t("marketplace.listing.save")
              }
              onPress={handleSave}
              loading={save.isPending}
              disabled={!isVerified}
              fullWidth
              icon={<BadgeCheck size={16} />}
            />
          </>
        ) : null}

        {/* ─── Incoming inquiries ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("marketplace.listing.inquiriesTitle")}
          />
          <View style={{ gap: spacing.sm }}>
            {incoming.length === 0 ? (
              <Card>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textMuted,
                  }}
                >
                  {t("marketplace.listing.noInquiries")}
                </Text>
              </Card>
            ) : (
              incoming.map((i) => (
                <Card
                  key={i.id}
                  style={{ gap: spacing.sm }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Avatar
                      uri={i.patientPhoto ?? undefined}
                      name={i.patientName ?? "?"}
                      size="md"
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.title.sm,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                        numberOfLines={1}
                      >
                        {i.patientName ?? "—"}
                      </Text>
                      <Pill
                        label={t(
                          `marketplace.inquiriesMine.status.${i.status}`
                        )}
                        tone={
                          i.status === "pending"
                            ? "info"
                            : i.status === "accepted"
                            ? "success"
                            : i.status === "declined"
                            ? "danger"
                            : "neutral"
                        }
                        size="sm"
                      />
                    </View>
                  </View>
                  <Text style={{ ...typography.body, color: colors.text }}>
                    {i.patientMessage}
                  </Text>
                  {i.status === "pending" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing.sm,
                      }}
                    >
                      <Button
                        label={t("marketplace.listing.accept")}
                        onPress={() => confirmAccept(i.id)}
                        compact
                      />
                      <Button
                        label={t("marketplace.listing.decline")}
                        onPress={() => confirmDecline(i.id)}
                        variant="outline"
                        compact
                      />
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}