// RecordHub: aggregated list view for the unified records screen.
// Reads /medical-records/me/canonical and renders per-kind rows with
// classification badge + amount-over-time sparkline.

import React, { useMemo } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { RECORD_REGISTRY, type RecordKind } from "@healthcare/shared/records";
import { useUnifiedRecords } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { AppText } from "@/components/ui/AppText";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface Props {
  familyMemberId?: string;
  selectedKinds?: RecordKind[];
  onSelectRecord?: (id: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
}

export function RecordHub({
  familyMemberId,
  selectedKinds,
  onSelectRecord,
  emptyTitle = "No records yet",
  emptyBody = "Tap + to add your first record",
}: Props) {
  const theme = useTheme();
  const { data, isLoading } = useUnifiedRecords({
    familyMemberId,
    limit: 200,
  });

  const items = useMemo(() => {
    const rows = data?.records ?? [];
    if (!selectedKinds || selectedKinds.length === 0) return rows;
    const set = new Set(selectedKinds);
    return rows.filter((r: any) => set.has((r.kind ?? r.recordType) as RecordKind));
  }, [data, selectedKinds]);

  if (isLoading) {
    return (
      <View style={{ padding: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 64, marginBottom: 8, borderRadius: 12 }} />
        ))}
      </View>
    );
  }
  if (!items.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(it: any) => it.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <RecordRow item={item} onPress={onSelectRecord} theme={theme} />
      )}
    />
  );
}

function RecordRow({
  item,
  onPress,
  theme,
}: {
  item: any;
  onPress?: (id: string) => void;
  theme: any;
}) {
  const kind = (item.kind ?? item.recordType) as RecordKind;
  const def = RECORD_REGISTRY[kind];
  const subtitle = [item.diagnosis, item.tags?.length ? `#${item.tags.join(" #")}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card onPress={onPress ? () => onPress(item.id) : undefined}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText variant="title.sm" numberOfLines={1}>
            {item.title}
          </AppText>
          {subtitle ? (
            <AppText variant="body.sm" color="muted" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Pill tone="info">{def?.icon ?? "Folder"}</Pill>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});