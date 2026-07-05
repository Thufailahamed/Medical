// @ts-nocheck
// records-v2/[id]/history.tsx — tamper-evidence history (gated by passphrase).

import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, AppText } from "@/components/ui";
import { EncryptionPassphrasePrompt, RevisionsList } from "@/components/records";

export default function RecordHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen padded>
      <AppText variant="title.lg">History</AppText>
      <View style={{ marginTop: 12 }}>
        <EncryptionPassphrasePrompt>
          <RevisionsList recordId={id ?? null} />
        </EncryptionPassphrasePrompt>
      </View>
    </Screen>
  );
}