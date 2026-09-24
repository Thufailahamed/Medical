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
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  ShieldUser,
  FileText,
  Languages,
  HeartHandshake,
  MapPin,
  Inbox,
  Check,
  X,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { Tone } from "@/theme/tone";
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
  Divider,
  EmptyState,
  useToast,
} from "@/components/ui";
import { VerificationRequestSheet } from "@/components/VerificationRequestSheet";
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

const DISTRICT_OPTIONS = [
  "Colombo",
  "Kandy",
  "Galle",
  "Jaffna",
  "Gampaha",
  "Matara",
  "Kurunegala",
];

function languageName(code: string, t: any): string {
  if (code === "en") return t("common.languageEnglish");
  if (code === "si") return t("common.languageSinhala");
  if (code === "ta") return t("common.languageTamil");
  return code;
}

function inquiryTone(status: string): Tone {
  if (status === "pending") return "info";
  if (status === "accepted") return "success";
  if (status === "declined") return "danger";
  return "neutral";
}

export default function CaretakerMarketplaceScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();

  const profile = useMyMarketplaceProfile();
  const save = useUpsertMarketplaceProfile();
  const inquiries = useMyMarketplaceInquiries();
  const accept = useAcceptMarketplaceInquiry();
  const decline = useDeclineMarketplaceInquiry();

  const v = profile.data;
  const isVerified = v?.verified === true;
  const p = v?.profile;

  const [verifyOpen, setVerifyOpen] = useState(false);
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
    Alert.alert(t("marketplace.listing.acceptConfirm"), "", [
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
    ]);
  }

  function confirmDecline(id: string) {
    Alert.alert(t("marketplace.listing.declineConfirm"), "", [
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
    ]);
  }

  const incoming = inquiries.data?.inquiries ?? [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("marketplace.listing.title")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 132,
        }}
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
        {!isVerified ? (
          /* ─── Verified gate ─── */
          <Card style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.warningSoft,
                }}
              >
                <ShieldUser size={20} color={colors.warning} />
              </View>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.text, flex: 1, fontWeight: "600" },
                ]}
              >
                {t("marketplace.listing.notVerified")}
              </Text>
            </View>
            <Button
              label={t("caretaker.verification.requestCta")}
              onPress={() => setVerifyOpen(true)}
              icon={BadgeCheck}
              fullWidth
            />
          </Card>
        ) : (
          <>
            {/* ─── Availability toggle ─── */}
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isAvailable
                      ? colors.successSoft
                      : colors.fill,
                  }}
                >
                  <HeartHandshake
                    size={20}
                    color={isAvailable ? colors.success : colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.title.sm, { color: colors.text }]}>
                    {t("marketplace.listing.available")}
                  </Text>
                  <Text
                    style={[typography.body.sm, { color: colors.textMuted }]}
                  >
                    {p
                      ? t("marketplace.listing.listedHint")
                      : t("marketplace.listing.notListed")}
                  </Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{
                    false: colors.fillStrong,
                    true: colors.success,
                  }}
                  ios_backgroundColor={colors.fillStrong}
                />
              </View>
            </Card>

            {/* ─── About / bio ─── */}
            <Card style={{ gap: spacing.sm }}>
              <FormSectionHeader
                icon={FileText}
                label={t("marketplace.listing.bio")}
              />
              <TextInput
                multiline
                numberOfLines={4}
                maxLength={1000}
                value={bio}
                onChangeText={setBio}
                placeholder={t("marketplace.listing.bioPlaceholder")}
              />
            </Card>

            {/* ─── Languages ─── */}
            <Card style={{ gap: spacing.sm }}>
              <FormSectionHeader
                icon={Languages}
                label={t("marketplace.listing.languages")}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <Chip
                    key={l}
                    label={languageName(l, t)}
                    selected={languages.includes(l)}
                    tone={languages.includes(l) ? "primary" : "neutral"}
                    onPress={() => setLanguages((prev) => toggle(prev, l))}
                  />
                ))}
              </View>
            </Card>

            {/* ─── Care roles ─── */}
            <Card style={{ gap: spacing.sm }}>
              <FormSectionHeader
                icon={HeartHandshake}
                label={t("marketplace.listing.roles")}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <Chip
                    key={r}
                    label={t(`caretaker.role.${r}`)}
                    selected={roles.includes(r)}
                    tone={roles.includes(r) ? "primary" : "neutral"}
                    onPress={() => setRoles((prev) => toggle(prev, r))}
                  />
                ))}
              </View>
            </Card>

            {/* ─── District / rate / experience ─── */}
            <Card style={{ gap: spacing.sm }}>
              <FormSectionHeader
                icon={MapPin}
                label={t("marketplace.listing.district")}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {DISTRICT_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={district === d}
                    tone={district === d ? "primary" : "neutral"}
                    onPress={() =>
                      setDistrict((prev) => (prev === d ? "" : d))
                    }
                  />
                ))}
              </View>
              <TextInput
                value={district}
                onChangeText={setDistrict}
                placeholder={t("marketplace.listing.districtPlaceholder")}
                style={{ marginTop: spacing.xs }}
              />

              <FormField
                label={t("marketplace.listing.rate")}
                helper={t("marketplace.listing.rateOptional")}
                style={{ marginTop: spacing.sm }}
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
                style={{ marginTop: spacing.sm }}
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
              icon={BadgeCheck}
            />
          </>
        )}

        {/* ─── Incoming inquiries ─── */}
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.xs,
            }}
          >
            <Inbox size={18} color={colors.textMuted} />
            <Text style={[typography.title.lg, { color: colors.text }]}>
              {t("marketplace.listing.inquiriesTitle")}
            </Text>
            {incoming.filter((i) => i.status === "pending").length > 0 ? (
              <Pill
                label={String(
                  incoming.filter((i) => i.status === "pending").length
                )}
                tone="info"
                size="sm"
              />
            ) : null}
          </View>

          {incoming.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("marketplace.listing.noInquiries")}
            />
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {incoming.map((i, idx) => (
                <View key={i.id}>
                  {idx > 0 ? (
                    <Divider style={{ marginLeft: spacing.lg + 40 + spacing.sm }} />
                  ) : null}
                  <View
                    style={{
                      padding: spacing.lg,
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <Avatar
                        source={
                          i.patientPhoto ? { uri: i.patientPhoto } : undefined
                        }
                        name={i.patientName ?? "?"}
                        size="md"
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <Text
                          style={[typography.title.md, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {i.patientName ?? "—"}
                        </Text>
                        <Pill
                          label={t(
                            `marketplace.inquiriesMine.status.${i.status}`
                          )}
                          tone={inquiryTone(i.status)}
                          size="sm"
                          style={{ alignSelf: "flex-start" }}
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        backgroundColor: colors.fill,
                        borderRadius: 14,
                        borderCurve: "continuous",
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.md,
                      }}
                    >
                      <Text
                        style={[
                          typography.overline,
                          {
                            color: colors.textSubtle,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          },
                        ]}
                      >
                        {t("marketplace.listing.patientMessage")}
                      </Text>
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.text, lineHeight: 19 },
                        ]}
                      >
                        {i.patientMessage}
                      </Text>
                    </View>

                    {i.status === "pending" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: spacing.sm,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Button
                            label={t("marketplace.listing.accept")}
                            onPress={() => confirmAccept(i.id)}
                            icon={Check}
                            compact
                            fullWidth
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            label={t("marketplace.listing.decline")}
                            onPress={() => confirmDecline(i.id)}
                            variant="danger"
                            icon={X}
                            compact
                            fullWidth
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <VerificationRequestSheet
        visible={verifyOpen}
        onDismiss={() => setVerifyOpen(false)}
      />
    </Screen>
  );
}

function FormSectionHeader({
  icon: Icon,
  label,
}: {
  icon: any;
  label: string;
}) {
  const { spacing, colors, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: 2,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon size={15} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={[typography.title.sm, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}
