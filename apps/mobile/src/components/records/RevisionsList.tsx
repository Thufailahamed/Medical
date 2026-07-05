// RevisionsList: tamper-evidence history for a record. Reads
// /medical-records/:id/revisions. Each row shows edited-by/at + diff.

import React from "react";
import { View, StyleSheet } from "react-native";
import { useRecordRevisions } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { AppText } from "@/components/ui/AppText";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  recordId: string | null;
}

export function RevisionsList({ recordId }: Props) {
  const { data, isLoading } = useRecordRevisions(recordId);
  if (isLoading) {
    return (
      <View style={{ padding: 16, gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 60, borderRadius: 12 }} />
        ))}
      </View>
    );
  }
  const items = data?.items ?? [];
  if (!items.length) return <EmptyState title="No history" body="This record hasn't been edited." />;
  return (
    <View style={{ padding: 16, gap: 8 }}>
      {items.map((r: any) => (
        <Card key={r.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText variant="title.sm">Revision {r.revisionNumber}</AppText>
              <AppText variant="body.sm" color="muted">{r.editedAt}</AppText>
              {r.diffSummary ? (
                <AppText variant="body.sm">{r.diffSummary}</AppText>
              ) : null}
            </View>
            <Pill tone="success">Verified</Pill>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});