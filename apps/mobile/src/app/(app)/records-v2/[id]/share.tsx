// @ts-nocheck
// records-v2/[id]/share.tsx — purpose-driven share sheet for one record.

import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, AppText } from "@/components/ui";
import { ShareConsentSheet } from "@/components/records";

export default function RecordShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [open, setOpen] = useState(true);
  return (
    <Screen padded>
      <AppText variant="title.lg">Share</AppText>
      <AppText variant="body.sm" color="muted">Record: {id}</AppText>
      <ShareConsentSheet open={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}