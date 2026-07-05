// RecordFilters: pill row of RecordKind filters. Used by the hub and the
// doctor/hospital portals.

import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { RECORD_REGISTRY, RECORD_KINDS, type RecordKind } from "@healthcare/shared/records";
import { Pill } from "@/components/ui/Pill";

interface Props {
  selected: RecordKind[];
  onChange: (kinds: RecordKind[]) => void;
}

export function RecordFilters({ selected, onChange }: Props) {
  const set = new Set(selected);
  const toggle = (k: RecordKind) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(Array.from(next));
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pill
        tone={selected.length === 0 ? "info" : "neutral"}
        onPress={() => onChange([])}
      >
        All
      </Pill>
      {RECORD_KINDS.map((k) => (
        <Pill
          key={k}
          tone={set.has(k) ? "info" : "neutral"}
          onPress={() => toggle(k)}
        >
          {RECORD_REGISTRY[k].key.replace(/_/g, " ")}
        </Pill>
      ))}
      <View style={{ width: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
});