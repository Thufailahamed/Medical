// ShareConsentSheet: purpose-driven consent grant sheet. Drives
// /consents POST. Single source for issuing family/insurance/referral
// consent grants.

import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { CONSENT_PURPOSES, PURPOSE_REGISTRY } from "@healthcare/shared/records";
import { useIssueConsent } from "@/hooks/useApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { AppText } from "@/components/ui/AppText";
import { TextInput } from "@/components/ui/TextInput";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPurpose?: string;
  recipientUserId?: string;
}

export function ShareConsentSheet({ open, onClose, defaultPurpose, recipientUserId }: Props) {
  const [purpose, setPurpose] = useState(defaultPurpose ?? "family_view");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [label, setLabel] = useState("");
  const issue = useIssueConsent();
  const toast = useToast();

  const submit = async () => {
    try {
      const result = await issue.mutateAsync({
        purpose,
        recipientUserId,
        durationDays,
        label: label || undefined,
        scope: { kinds: ["*"] },
      });
      toast({ title: "Consent issued", tone: "success" });
      onClose();
      return result;
    } catch (err) {
      toast({ title: "Failed", body: (err as Error).message, tone: "error" });
    }
  };

  return (
    <BottomSheet visible={open} onDismiss={onClose} title="Share records">
      <ScrollView contentContainerStyle={styles.body}>
        <AppText variant="title.sm">Purpose</AppText>
        <View style={styles.row}>
          {CONSENT_PURPOSES.map((p) => (
            <Pill
              key={p}
              tone={purpose === p ? "info" : "neutral"}
              onPress={() => setPurpose(p)}
            >
              {PURPOSE_REGISTRY[p].labelKey.split(".").pop()}
            </Pill>
          ))}
        </View>

        <FormField label="Duration (days)">
          <TextInput
            value={String(durationDays)}
            keyboardType="numeric"
            onChangeText={(s) => setDurationDays(parseInt(s || "30", 10) || 30)}
          />
        </FormField>

        <FormField label="Label (optional)">
          <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Dr Smith follow-up" />
        </FormField>

        <Button label="Issue consent" onPress={submit} loading={issue.isPending} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});