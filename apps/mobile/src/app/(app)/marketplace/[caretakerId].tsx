// @ts-nocheck
// Caretaker Profiles: Marketplace — caretaker detail + inquiry sheet.

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Send,
  MapPin,
  Languages,
  Briefcase,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Chip,
  Pill,
  Avatar,
  Button,
  FormField,
  TextInput,
  BottomSheet,
  useToast,
} from "@/components/ui";
import {
  useMarketplaceCaretaker,
  useSendMarketplaceInquiry,
} from "@/hooks/useCaretakerMarketplace";
import {
  useMyMarketplaceInquiriesSent,
} from "@/hooks/useCaretakerMarketplace";

export default function MarketplaceCaretakerDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ caretakerId: string }>();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const detail = useMarketplaceCaretaker(params.caretakerId);
  const send = useSendMarketplaceInquiry();
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

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={c?.name ?? "—"} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        {detail.isLoading ? (
          <Card>
            <Text style={{ ...typography.body, color: colors.textMuted }}>
              {t("common.loading")}
            </Text>
          </Card>
        ) : !c ? (
          <Card>
            <Text style={{ ...typography.body, color: colors.danger }}>
              {t("marketplace.notFound")}
            </Text>
          </Card>
        ) : (
          <>
            {/* ─── Hero ─── */}
            <Card padded={false}>
              <View
                style={{
                  padding: spacing.xl,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.lg,
                }}
              >
                <Avatar uri={c.photo ?? undefined} name={c.name} size="2xl" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Text
                      style={[
                        typography.title.lg,
                        { color: colors.text, fontWeight: "800" },
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                    {c.verified ? (
                      <BadgeCheck size={16} color={colors.success} />
                    ) : null}
                  </View>
                  {c.district ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                        marginTop: 2,
                      }}
                    >
                      <MapPin size={12} color={colors.textMuted} />
                      <Text
                        style={[
                          typography.body.sm,
                          { color: colors.textMuted },
                        ]}
                      >
                        {c.district}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    style={[
                      typography.body.sm,
                      { color: colors.text, marginTop: spacing.xs },
                    ]}
                  >
                    {c.hourlyRateLkr
                      ? `LKR ${c.hourlyRateLkr}/hr`
                      : t("marketplace.rateOnRequest")}
                  </Text>
                </View>
              </View>
            </Card>

            {/* ─── About ─── */}
            {c.bio ? (
              <Card>
                <Text
                  style={{
                    ...typography.h3,
                    color: colors.text,
                    marginBottom: spacing.xs,
                  }}
                >
                  {t("marketplace.listing.bio")}
                </Text>
                <Text style={{ ...typography.body, color: colors.text }}>
                  {c.bio}
                </Text>
              </Card>
            ) : null}

            {/* ─── Care roles ─── */}
            <Card>
              <Text
                style={{
                  ...typography.h3,
                  color: colors.text,
                  marginBottom: spacing.xs,
                }}
              >
                {t("marketplace.listing.roles")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                {c.careRolesOffered.map((r) => (
                  <Chip key={r} label={t(`caretaker.role.${r}`)} />
                ))}
              </View>
            </Card>

            {/* ─── Languages ─── */}
            {c.languages.length ? (
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    marginBottom: spacing.xs,
                  }}
                >
                  <Languages size={14} color={colors.textMuted} />
                  <Text style={{ ...typography.h3, color: colors.text }}>
                    {t("marketplace.listing.languages")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.xs,
                  }}
                >
                  {c.languages.map((l) => (
                    <Chip key={l} label={l} />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* ─── Experience ─── */}
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Briefcase size={14} color={colors.textMuted} />
                <Text style={{ ...typography.body, color: colors.text }}>
                  {t("marketplace.experienceYears", {
                    n: c.experienceYears ?? 0,
                  })}
                </Text>
              </View>
            </Card>

            {/* ─── Sticky CTA ─── */}
            {acceptedInquiry ? (
              <Card>
                <Pill
                  label={t("marketplace.inquiry.alreadyLinked")}
                  tone="success"
                />
              </Card>
            ) : pendingInquiry ? (
              <Card>
                <Pill
                  label={t("marketplace.inquiry.alreadyPending")}
                  tone="info"
                />
              </Card>
            ) : (
              <Button
                label={t("marketplace.ctaSendInquiry")}
                onPress={() => setSheetOpen(true)}
                icon={<Send size={16} />}
                fullWidth
              />
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Inquiry sheet ─── */}
      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ ...typography.h3, color: colors.text }}>
            {t("marketplace.inquiry.title")}
          </Text>
          <Text
            style={{
              ...typography.bodySmall,
              color: colors.textSecondary,
            }}
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
            fullWidth
          />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}