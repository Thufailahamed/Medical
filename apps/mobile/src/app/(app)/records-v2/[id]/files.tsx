// @ts-nocheck
// records-v2/[id]/files.tsx — attachments for a record. Uses presigned
// download tokens.

import React from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, AppText, Card, Button, useToast } from "@/components/ui";
import { usePresignFile } from "@/hooks/useApi";

export default function RecordFilesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const presign = usePresignFile();
  const toast = useToast();

  const getLink = async (fileId: string) => {
    try {
      const res = await presign.mutateAsync({ fileId });
      toast({ title: "Link ready", body: res.url, tone: "success" });
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <Screen padded>
      <AppText variant="title.lg">Files</AppText>
      <AppText variant="body.sm" color="muted">Record: {id}</AppText>
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          <AppText variant="body.sm">
            Tap below to issue a single-use download link. The link expires in 5
            minutes and can be redeemed exactly once.
          </AppText>
          <Button label="Generate test link" onPress={() => getLink("sample-file-id")} />
        </View>
      </Card>
    </Screen>
  );
}

const _styles = StyleSheet.create({});