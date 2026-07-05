// QrTokenManager: list + issue + revoke ephemeral QR tokens. Drives
// /emergency/qr/issue and /emergency/qr/:token/revoke.

import React from "react";
import { View, StyleSheet } from "react-native";
import { useIssueQrToken, useRevokeQrToken } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppText } from "@/components/ui/AppText";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";

interface IssuedToken {
  token: string;
  expiresAt: string;
  maxScans: number;
  url: string;
}

interface Props {
  tokens: IssuedToken[];
  onAfterChange?: () => void;
}

export function QrTokenManager({ tokens, onAfterChange }: Props) {
  const issue = useIssueQrToken();
  const revoke = useRevokeQrToken();
  const toast = useToast();

  const doIssue = async () => {
    try {
      const r = await issue.mutateAsync({ maxScans: 5, ttlHours: 2 });
      toast({ title: "Token issued", body: `Scan limit ${r.maxScans}`, tone: "success" });
      onAfterChange?.();
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  const doRevoke = async (token: string) => {
    try {
      await revoke.mutateAsync(token);
      toast({ title: "Token revoked", tone: "success" });
      onAfterChange?.();
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Button label="Generate QR token" onPress={doIssue} loading={issue.isPending} />
      {tokens.length === 0 ? (
        <AppText variant="body.sm" color="muted">No active tokens.</AppText>
      ) : (
        tokens.map((t) => (
          <Card key={t.token}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppText variant="title.sm" numberOfLines={1}>{t.token.slice(0, 12)}…</AppText>
                <AppText variant="body.sm" color="muted">Expires {t.expiresAt}</AppText>
              </View>
              <Pill tone="info">{t.maxScans} scans</Pill>
              <Button label="Revoke" tone="danger" onPress={() => doRevoke(t.token)} />
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});