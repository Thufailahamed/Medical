// EncryptionPassphrasePrompt: thin wrapper around the in-memory
// passphraseGate. Used by RecordRevisions and any other screen that
// surfaces tamper-sensitive data.

import React from "react";
import { View, StyleSheet } from "react-native";
import { passphraseGate } from "@/lib/encryption-cache";
import { Button } from "@/components/ui/Button";
import { AppText } from "@/components/ui/AppText";
import { Card } from "@/components/ui/Card";

interface Props {
  children: React.ReactNode;
}

export function EncryptionPassphrasePrompt({ children }: Props) {
  const [unlocked, setUnlocked] = React.useState(passphraseGate.isUnlocked());
  if (unlocked) return <>{children}</>;
  return (
    <Card>
      <View style={styles.body}>
        <AppText variant="title.sm">Unlock sensitive records</AppText>
        <AppText variant="body.sm" color="muted">
          Enter your passphrase to view revision history and tamper-evidence chain.
        </AppText>
        <Button
          label="Unlock"
          onPress={() => {
            passphraseGate.unlock();
            setUnlocked(true);
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
});