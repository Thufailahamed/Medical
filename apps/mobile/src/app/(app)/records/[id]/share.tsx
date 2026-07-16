// @ts-nocheck
// records-v2/[id]/share.tsx — unified share mode picker for a single
// record. PR2 surfaces Visit / Ongoing / In-person from one entry point.

import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, AppText } from "@/components/ui";
import { ShareModeSheet } from "@/components/records";

export default function RecordShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [open, setOpen] = useState(true);
  return (
    <Screen padded>
      <AppText variant="title.lg">Share</AppText>
      <AppText variant="body.sm" color="muted">Record: {id}</AppText>
      <ShareModeSheet
        open={open}
        onClose={() => setOpen(false)}
        recordId={id}
      />
    </Screen>
  );
}