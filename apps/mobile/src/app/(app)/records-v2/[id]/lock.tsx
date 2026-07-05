// @ts-nocheck
// records-v2/[id]/lock.tsx — break-glass lock/unlock for a record.
// 2FA required post-v3; for v3 this is a stub that toggles the
// `locked_until` column via PATCH /medical-records/:id.

import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, AppText, Card, Button } from "@/components/ui";
import { useEditMedicalRecord } from "@/hooks/useApi";
import { useToast } from "@/components/ui/Toast";

export default function RecordLockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const edit = useEditMedicalRecord();
  const toast = useToast();

  const toggleLock = async () => {
    if (!id) return;
    try {
      await edit.mutateAsync({
        id,
        // @ts-expect-error — extension to legacy PATCH body
        lockedUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
      });
      toast({ title: "Locked for 7 days", tone: "success" });
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <Screen padded>
      <AppText variant="title.lg">Lock</AppText>
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          <AppText variant="body.sm">
            Lock this record for 7 days. While locked, all sharing + downloads are suspended.
          </AppText>
          <Button label="Lock for 7 days" tone="danger" onPress={toggleLock} loading={edit.isPending} />
        </View>
      </Card>
    </Screen>
  );
}