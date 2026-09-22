// @ts-nocheck
// Caretaker Profiles: Marketplace — caretaker detail + inquiry sheet.

import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Send,
  MapPin,
  Languages,
  Briefcase,
  ShieldCheck,
  Clock,
  Undo2,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  Avatar,
  Button,
  FormField,
  TextInput,
  BottomSheet,
  Skeleton,
  useToast,
} from "@/components/ui";
import {
  useMarketplaceCaretaker,
  useSendMarketplaceInquiry,
  useWithdrawMarketplaceInquiry,
  useMyMarketplaceInquiriesSent,
} from "@/hooks/useCaretakerMarketplace";

function languageName(code: string, t: any): string {
  if (code === "en") return t("common.languageEnglish");
  if (code === "si") return t("common.languageSinhala");
  if (code === "ta") return t("common.languageTamil");
  return code;
}

export default function MarketplaceCaretakerDetail() {
  const params = useLocalSearchParams<{ caretakerId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, shadow } = useTheme();
  const toast = useToast();

  const detail = useMarketplaceCaretaker(params.caretakerId);
  const send = useSendMarketplaceInquiry();
  const withdraw = useWithdrawMarketplaceInquiry();
  const sent = useMyMarketplaceInquiriesSent();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState("");

  const c = detail.data?.caretaker;

  // Already linked or already-pending? Disabled states.
  const pendingInquiry = (sent.data?.inquiries ?? []).find(
    (i) => i.caretakerUserId === params.caretakerId && i.status === "pending"
  );
  const acceptedInquiry = (sent.data?.inquiries ?? []).find(
    (i) => i.caretakerUserId === params.caretakerId && i.status === "accepted"
  );

  async function handleSubmit() {
    if (message.trim().length < 10) {
      toast.show(t("marketplace.inquiry.messagePlaceholder"), "danger");
      return;
    }
    try {
      await send.mutateAsync({
        caretakerUserId: params.caretakerId,
        patientMessage: message.trim(),
      });
      toast.show(t("marketplace.inquiry.sent"), "success");
      setSheetOpen(false);
      setMessage("");
    } catch (err: any) {
      const code = err?.code ?? err?.data?.code;
      const msg =
        code === "already_linked"
          ? t("marketplace.inquiry.alreadyLinked")
          : code === "already_pending"
          ? t("marketplace.inquiry.alreadyPending")
          : t("marketplace.inquiry.failed");
      toast.show(msg, "danger");
    }
  }

  function handleWithdraw() {
    if (!pendingInquiry) return;
    withdraw.mutate(pendingInquiry.id, {
      onSuccess: () => toast.show(t("marketplace.inquiry.withdrawn"), "info"),
      onError: () => toast.show(t("common.error"), "danger"),
    });
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("marketplace.title")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.xs,
          gap: spacing.md,
          paddingBottom: spacing.xxxxl,
        }}
      >
        {detail.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Card style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Skeleton width={72} height={72} radius={36} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Skeleton width="55%" height={18} />
                  <Skeleton width="75%" height={12} />
                </View>
              </View>
            </Card>
            <Card>
              <Skeleton width="40%" height={14} />
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                <Skeleton height={11} />
                <Skeleton height={11} />
                <Skeleton width="70%" height={11} />
              </View>
            </Card>
          </View>
        ) : !c ? (
          <Card>
            <Text
              style={[typography.body.md, { color: colors.danger }]}
            >
              {t("marketplace.notFound")}
            </Text>
          </Card>
        ) : (
          <>
            {/* ─── Gradient hero ─── */}
            <Card
              padded={false}
              elevated={false}
              style={{
                borderRadius: radius.xxxl,
                borderWidth: 0,
                overflow: "hidden",
                ...shadow.hero,
              }}
            >
              <LinearGradient
                colors={["#0B2B64", "#0C5C8C", "#0C8B8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: spacing.xl }}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: "#0C8B8C",
                      opacity: 0.32,
                      borderRadius: 200,
                      transform: [{ translateX: 120 }, { translateY: -80 }],
                    },
                  ]}
                  pointerEvents="none"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 44,
                    backgroundColor: "rgba(255, 255, 255, 0.10)",
                  }}
                  pointerEvents="none"
                />
                <ShieldCheck
                  size={150}
                  color="#FFFFFF"
                  strokeWidth={1}
                  style={{
                    position: "absolute",
                    right: -30,
                    bottom: -30,
                    opacity: 0.1,
                  }}
                  pointerEvents="none"
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      padding: 3,
                      backgroundColor: "rgba(255, 255, 255, 0.22)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.45)",
                    }}
                  >
                    <View
                      style={{
                        borderRadius: 999,
                        backgroundColor: "#FFFFFF",
                        padding: 3,
                      }}
                    >
                      <Avatar
                        source={c.photo ? { uri: c.photo } : undefined}
                        name={c.name}
                        size="xl"
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          typography.title.lg,
                          { color: "#FFFFFF", fontWeight: "800" },
                        ]}
                        numberOfLines={2}
                      >
                        {c.name}
                      </Text>
                      {c.verified ? (
                        <BadgeCheck size={16} color="#8FF0C4" />
                      ) : null}
                    </View>
                    {c.district ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MapPin size={12} color="rgba(255,255,255,0.85)" />
                        <Text
                          style={[
                            typography.body.sm,
                            { color: "rgba(255,255,255,0.85)" },
                          ]}
                        >
                          {c.district}
                        </Text>
                      </View>
                    ) : null}
                    {c.verified ? (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          paddingHorizontal: spacing.sm + 2,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: "rgba(143, 240, 196, 0.18)",
                          borderWidth: 1,
                          borderColor: "rgba(143, 240, 196, 0.45)",
                        }}
                      >
                        <Text
                          style={[
                            typography.caption,
                            { color: "#8FF0C4", fontWeight: "700", fontSize: 11 },
                          ]}
                        >
                          {t("marketplace.verified")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </LinearGradient>
            </Card>

            {/* ─── Stat tiles ─── */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
              }}
            >
              <StatTile
                label={t("marketplace.listing.rate")}
                value={
                  c.hourlyRateLkr
                    ? `LKR ${c.hourlyRateLkr}`
                    : t("marketplace.rateOnRequest")
                }
                hint={c.hourlyRateLkr ? t("marketplace.perHour") : null}
              />
              <StatTile
                label={t("marketplace.listing.experience")}
                value={t("marketplace.experienceYears", {
                  n: c.experienceYears ?? 0,
                })}
              />
              <StatTile
                label={t("marketplace.listing.languages")}
                value={
                  c.languages.length
                    ? c.languages.map((l) => languageName(l, t)).join(", ")
                    : "—"
                }
              />
            </View>

            {/* ─── About ─── */}
            {c.bio ? (
              <Card style={{ gap: spacing.sm }}>
                <SectionLabel
                  icon={Briefcase}
                  label={t("marketplace.listing.bio")}
                />
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.text, lineHeight: 20 },
                  ]}
                >
                  {c.bio}
                </Text>
              </Card>
            ) : null}

            {/* ─── Care roles ─── */}
            <Card style={{ gap: spacing.sm }}>
              <SectionLabel
                icon={ShieldCheck}
                label={t("marketplace.listing.roles")}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                {c.careRolesOffered.map((r) => (
                  <Pill
                    key={r}
                    label={t(`caretaker.role.${r}`)}
                    tone="primary"
                  />
                ))}
              </View>
            </Card>

            {/* ─── Languages ─── */}
            {c.languages.length ? (
              <Card style={{ gap: spacing.sm }}>
                <SectionLabel
                  icon={Languages}
                  label={t("marketplace.listing.languages")}
                />
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                  }}
                >
                  {c.languages.map((l) => (
                    <Pill
                      key={l}
                      label={languageName(l, t)}
                      tone="neutral"
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* ─── CTA / status ─── */}
            {acceptedInquiry ? (
              <Card
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <BadgeCheck size={18} color={colors.success} />
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.success, flex: 1, fontWeight: "600" },
                  ]}
                >
                  {t("marketplace.inquiry.alreadyLinked")}
                </Text>
              </Card>
            ) : pendingInquiry ? (
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
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.infoSoft,
                    }}
                  >
                    <Clock size={16} color={colors.info} />
                  </View>
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.text, flex: 1, fontWeight: "600" },
                    ]}
                  >
                    {t("marketplace.inquiry.alreadyPending")}
                  </Text>
                </View>
                <Button
                  label={t("marketplace.inquiry.withdraw")}
                  onPress={handleWithdraw}
                  variant="outline"
                  loading={withdraw.isPending}
                  icon={Undo2}
                  fullWidth
                />
              </Card>
            ) : (
              <Button
                label={t("marketplace.ctaSendInquiry")}
                onPress={() => setSheetOpen(true)}
                icon={Send}
                fullWidth
              />
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Inquiry sheet ─── */}
      <BottomSheet visible={sheetOpen} onDismiss={() => setSheetOpen(false)}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[typography.title.lg, { color: colors.text }]}
          >
            {t("marketplace.inquiry.title")}
          </Text>
          <Text
            style={[typography.body.sm, { color: colors.textMuted }]}
          >
            {t("marketplace.inquiry.helper", { name: c?.name ?? "" })}
          </Text>
          <FormField label={t("marketplace.inquiry.messageLabel")}>
            <TextInput
              multiline
              numberOfLines={4}
              maxLength={500}
              value={message}
              onChangeText={setMessage}
              placeholder={t("marketplace.inquiry.messagePlaceholder")}
            />
          </FormField>
          <Button
            label={
              send.isPending
                ? t("marketplace.inquiry.sending")
                : t("marketplace.inquiry.submit")
            }
            onPress={handleSubmit}
            disabled={message.trim().length < 10}
            loading={send.isPending}
            icon={Send}
            fullWidth
          />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  const { spacing, colors, typography } = useTheme();
  return (
    <Card
      style={{
        flex: 1,
        padding: spacing.md,
        gap: 3,
        alignItems: "flex-start",
      }}
    >
      <Text
        style={[
          typography.caption,
          {
            color: colors.textMuted,
            fontWeight: "700",
            fontSize: 10.5,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, fontWeight: "800" },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

function SectionLabel({
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
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon size={13} color={colors.primary} />
      </View>
      <Text
        style={[
          typography.label.md,
          { color: colors.text, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
