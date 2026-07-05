// DicomPreviewCard: shows extracted DICOM metadata for an imaging
// attachment. Reads /document-dicom/:fileId (a future endpoint; for v3
// the data is embedded in the file metadata via the records canonical
// view).

import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { AppText } from "@/components/ui/AppText";
import { Pill } from "@/components/ui/Pill";

interface Props {
  metadata?: {
    modality?: string | null;
    bodyPart?: string | null;
    studyDate?: string | null;
    manufacturer?: string | null;
  } | null;
}

export function DicomPreviewCard({ metadata }: Props) {
  if (!metadata) return null;
  return (
    <Card>
      <View style={{ gap: 6 }}>
        <AppText variant="title.sm">Imaging metadata</AppText>
        <View style={styles.row}>
          <Pill tone="info">{metadata.modality ?? "Unknown modality"}</Pill>
          {metadata.bodyPart ? <Pill tone="neutral">{metadata.bodyPart}</Pill> : null}
        </View>
        <AppText variant="body.sm" color="muted">
          {metadata.studyDate ? `Study ${metadata.studyDate}` : "Date unknown"}
          {metadata.manufacturer ? ` · ${metadata.manufacturer}` : ""}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
});