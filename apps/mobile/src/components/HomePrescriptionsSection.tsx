// @ts-nocheck

import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Stethoscope,
  Pill,
  CalendarDays,
  ShieldCheck,
  PackageCheck,
  ChevronRight,
  Repeat,
  Sparkles,
  ArrowRight,
} from "lucide-react-native";
import { useMyPrescriptions } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateLong } from "@/lib/format";
import { Card, Skeleton, Pressable } from "@/components/ui";

function formatDate(iso: string | null | undefined, locale: any): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return fmtDateLong(d, locale);
}

export function HomePrescriptionsSection() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography, radius, scheme } = useTheme();
  const isDark = scheme === "dark";
  const locale = useLocaleStore((s) => s.locale);

  const { data, isLoading } = useMyPrescriptions();
  const prescriptions: any[] = data?.prescriptions || [];

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Section Heading */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.xs,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            typography.overline,
            { color: colors.textSubtle, letterSpacing: 1.4, fontWeight: "700" },
          ]}
        >
          {t("myPrescriptions.title", "My Prescriptions").toUpperCase()}
        </Text>

        <Pressable
          onPress={() => router.push("/(app)/prescriptions")}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t("home.seeAll", "See All")}
        >
          <Text
            style={[
              typography.label.md,
              { color: colors.primary, fontWeight: "700" },
            ]}
          >
            {(t("home.seeAll", "See All") || "See All") + " →"}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={110} radius={radius.xl} />
          <Skeleton height={110} radius={radius.xl} />
        </View>
      ) : prescriptions.length === 0 ? (
        <Card
          style={{
            padding: spacing.md,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.border,
            backgroundColor: isDark
              ? "rgba(59, 130, 246, 0.08)"
              : colors.primarySoft,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClipboardList size={22} color={colors.onPrimary} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "800" },
                  ]}
                >
                  {t("myPrescriptions.heroTitle", "Official e-Prescriptions")}
                </Text>
                <Sparkles size={13} color={colors.primary} />
              </View>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2, lineHeight: 16 },
                ]}
              >
                {t(
                  "myPrescriptions.emptyBody",
                  "When your doctor issues a signed e-prescription, it will appear here."
                )}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/(app)/prescriptions")}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                {t("home.viewDetails", "View")}
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {prescriptions.slice(0, 2).map((r: any) => {
            const isSigned = r.status === "signed" || r.status === "active";
            const isDispensed = r.status === "dispensed" || r.status === "completed";
            const dateStr = formatDate(r.date || r.createdAt, locale);
            const medCount = r.medicineCount || r.medicines?.length || 0;
            const medicines = r.medicines || [];

            return (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/prescription-detail",
                    params: { id: r.id },
                  } as any)
                }
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : colors.border,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0 : 0.03,
                  shadowRadius: 5,
                  elevation: 1,
                })}
              >
                {/* Header row: Icon + Diagnosis Title + Status Badge */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.15)"
                          : colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ClipboardList
                        size={19}
                        color={colors.primary}
                        strokeWidth={2.2}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          typography.title.sm,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                        numberOfLines={1}
                      >
                        {r.diagnosis || t("myPrescriptions.fallbackTitle", "Prescription")}
                      </Text>

                      {/* Doctor Name */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 1,
                        }}
                      >
                        <Stethoscope
                          size={11}
                          color={colors.primary}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted, flex: 1, fontWeight: "500" },
                          ]}
                          numberOfLines={1}
                        >
                          {r.doctorName || "Licensed Practitioner"}
                          {r.doctorSpecialization ? ` · ${r.doctorSpecialization}` : ""}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Status Badge */}
                  {isSigned ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: radius.full,
                        backgroundColor: colors.successSoft,
                      }}
                    >
                      <ShieldCheck size={11} color={colors.success} strokeWidth={2.6} />
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontWeight: "800",
                          color: colors.success,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {t("myPrescriptions.status.signed", "Signed")}
                      </Text>
                    </View>
                  ) : isDispensed ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: radius.full,
                        backgroundColor: colors.primarySoft,
                      }}
                    >
                      <PackageCheck size={11} color={colors.primary} strokeWidth={2.6} />
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontWeight: "800",
                          color: colors.primary,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {t("myPrescriptions.status.dispensed", "Dispensed")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Medicine preview chips (if available) */}
                {medicines.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 5,
                      marginTop: spacing.sm,
                    }}
                  >
                    {medicines.slice(0, 2).map((m: any, idx: number) => (
                      <View
                        key={m.id || idx}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : colors.surfaceMuted,
                          paddingHorizontal: 7,
                          paddingVertical: 2.5,
                          borderRadius: radius.xs,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: colors.primary,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: "600",
                            color: colors.text,
                          }}
                          numberOfLines={1}
                        >
                          {m.name}
                          {m.dosage ? ` (${m.dosage})` : ""}
                        </Text>
                      </View>
                    ))}
                    {medicines.length > 2 && (
                      <View
                        style={{
                          paddingHorizontal: 5,
                          paddingVertical: 2.5,
                          borderRadius: radius.xs,
                          backgroundColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9.5,
                            fontWeight: "700",
                            color: colors.textMuted,
                          }}
                        >
                          +{medicines.length - 2} more
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Footer Row: Date & Action CTA */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: spacing.sm,
                    paddingTop: spacing.xs,
                    borderTopWidth: 1,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <CalendarDays size={11} color={colors.textSubtle} strokeWidth={2.2} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.textSubtle,
                        }}
                      >
                        {dateStr}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Pill size={11} color={colors.textSubtle} strokeWidth={2.2} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.textSubtle,
                        }}
                      >
                        {medCount === 1
                          ? t("myPrescriptions.medCount_one", "1 medicine")
                          : t("myPrescriptions.medCount_other", {
                              count: medCount,
                              defaultValue: `${medCount} medicines`,
                            })}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {isSigned && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push("/(app)/refill");
                        }}
                        hitSlop={6}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: radius.full,
                          backgroundColor: isDark
                            ? "rgba(59, 130, 246, 0.15)"
                            : colors.primarySoft,
                        }}
                      >
                        <Repeat size={10} color={colors.primary} strokeWidth={2.4} />
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: "700",
                            color: colors.primary,
                          }}
                        >
                          {t("myPrescriptions.requestRefill", "Refill")}
                        </Text>
                      </Pressable>
                    )}
                    <ChevronRight size={15} color={colors.textSubtle} strokeWidth={2.4} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
