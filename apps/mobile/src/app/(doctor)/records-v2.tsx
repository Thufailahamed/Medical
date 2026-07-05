// @ts-nocheck
// Doctor-side records-v2 view: lists patients whose care-team grants
// include a "records_recent" or "records_all" scope. Each row taps
// into the patient's unified record hub.

import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, AppText, EmptyState } from "@/components/ui";
import { useConsentsIssued } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export default function DoctorRecordsV2() {
  const { t } = useTranslation();
  const { data, isLoading } = useConsentsIssued();
  const items = (data?.items ?? []).filter((c: any) =>
    c.scope?.defaultScope?.includes("records_all") ||
    c.scope?.defaultScope?.includes("records_recent") ||
    c.scope?.kinds?.includes?.("*"),
  );
  if (isLoading) return <Screen padded><AppText>Loading…</AppText></Screen>;
  if (!items.length) {
    return (
      <Screen padded>
        <EmptyState
          title={t("doctorPatientDetail.empty", "No patients yet")}
          body={t("doctorPatientDetail.emptyBody", "Patients who grant you record access will appear here.")}
        />
      </Screen>
    );
  }
  return (
    <Screen padded>
      <AppText variant="title.lg">{t("doctorPatientDetail.recordsTab", "Records")}</AppText>
      <View style={{ marginTop: 12, gap: 8 }}>
        {items.map((c: any) => (
          <Card key={c.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="title.sm">Patient {c.patientId}</AppText>
                <AppText variant="body.sm" color="muted">{c.purpose} · expires {c.expiresAt}</AppText>
              </View>
              <Pill tone="info">{c.purpose}</Pill>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}