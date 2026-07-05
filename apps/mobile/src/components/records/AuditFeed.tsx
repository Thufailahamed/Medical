// AuditFeed: read-only viewer for the consent + audit timeline.
// Reads /consents/audit (new) and /audit/me (existing).

import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useConsentAudit } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { AppText } from "@/components/ui/AppText";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

export function AuditFeed() {
  const { typography, colors } = useTheme();
  const { data, isLoading } = useConsentAudit();
  if (isLoading) {
    return (
      <View style={{ padding: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 64, marginBottom: 8, borderRadius: 12 }} />
        ))}
      </View>
    );
  }
  const items = data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        title="No activity"
        body="Sharing activity will appear here."
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      {items.map((it: any) => (
        <Card key={it.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText style={[typography.title.sm, { color: colors.text }]}>
                {it.purpose}
              </AppText>
              <AppText
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                Granted {it.grantedAt} {it.label ? `· ${it.label}` : ""}
              </AppText>
              {it.revokedAt ? (
                <AppText
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                >
                  Revoked {it.revokedAt}
                </AppText>
              ) : null}
            </View>
            <Pill
              tone={
                it.status === "active"
                  ? "success"
                  : it.status === "revoked"
                  ? "danger"
                  : "neutral"
              }
            >
              {it.status}
            </Pill>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});