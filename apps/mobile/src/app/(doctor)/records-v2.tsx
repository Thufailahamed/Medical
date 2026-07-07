// @ts-nocheck
// Doctor-side records-v2 view: lists patients whose care-team grants
// include a "records_recent" or "records_all" scope. Each row taps
// into the patient's unified record hub.

import React from "react";
import { View, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, ScreenHeader, ListItem, Avatar, EmptyState } from "@/components/ui";
import { useConsentsIssued } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { ShieldCheck, ChevronRight } from "lucide-react-native";

export default function DoctorRecordsV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacing, colors } = useTheme();
  const { data, isLoading } = useConsentsIssued();

  const items = (data?.items ?? []).filter((c: any) =>
    c.scope?.defaultScope?.includes("records_all") ||
    c.scope?.defaultScope?.includes("records_recent") ||
    c.scope?.kinds?.includes?.("*")
  );

  function formatDate(isoString: string): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString.split("T")[0];
    }
  }

  if (isLoading) {
    return (
      <Screen padded>
        <ScreenHeader title={t("doctorPatientDetail.recordsTab", "Patient Records")} back />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {/* Fallback loading */}
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader
        title={t("doctorPatientDetail.recordsTab", "Patient Records")}
        subtitle={t("doctorPatientDetail.recordsSubtitle", "Patients who granted you record access")}
        back
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("doctorPatientDetail.empty", "No records shared yet")}
            message={t("doctorPatientDetail.emptyBody", "When patients grant you access to their digital health records, they will appear here.")}
            tone="neutral"
          />
        ) : (
          items.map((c: any) => {
            const name = c.patientName || c.label || `Patient ${c.patientId.slice(0, 8)}`;
            const subtitle = `${c.purpose} · Exp: ${formatDate(c.expiresAt)}`;
            return (
              <ListItem
                key={c.id}
                variant="contact"
                title={name}
                subtitle={subtitle}
                iconTone="primary"
                mediaSlot={
                  <Avatar
                    name={name}
                    size="md"
                    tone="primary"
                    source={c.patientPhoto ? { uri: c.patientPhoto } : undefined}
                  />
                }
                pill={{
                  label: c.scope?.defaultScope?.includes("records_all") ? "Full Access" : "Recent Only",
                  tone: c.scope?.defaultScope?.includes("records_all") ? "success" : "info"
                }}
                trailing={
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
                  </View>
                }
                onPress={() =>
                  router.push({
                    pathname: "/patient-detail" as any,
                    params: { id: c.patientId },
                  })
                }
              />
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}