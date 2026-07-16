// SharePackSheet — Tier 1 records: share-pack creation surface.
//
// Bottom sheet with a 3-step flow:
//   1. Pick records (multi-select; pre-fills from defaultRecordIds)
//   2. Name + expiry (24h / 7d / 30d / 90d chips)
//   3. Confirm + POST /share/links with `recordIds: [...]`
//
// Server sets kind="record_bundle" + record_ids column (migration 0057).
// Returns the share URL + token to the caller via onCreated().
//
// We deliberately do NOT re-implement the consent / QR flows here —
// the visit-mode picker (PR2's ShareModeSheet) handles those. This
// sheet is the "bundle N records into one link" primitive.

import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share as RNShare } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { AppText } from "@/components/ui/AppText";
import { TextInput } from "@/components/ui/TextInput";
import { FormField } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";
import { useCreateSharePack, useUnifiedRecords } from "@/hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultRecordIds?: string[];
}

const EXPIRY_CHIPS: { label: string; hours: number }[] = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
  { label: "90d", hours: 24 * 90 },
];

export function SharePackSheet({ open, onClose, defaultRecordIds = [] }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const createPack = useCreateSharePack();

  const { data: recordsData } = useUnifiedRecords({ limit: 100 });
  const allRecords = (recordsData?.records as any[]) ?? [];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<Set<string>>(new Set(defaultRecordIds));
  const [label, setLabel] = useState("");
  const [expiryHours, setExpiryHours] = useState(24 * 7);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setPicked(new Set(defaultRecordIds));
      setLabel("");
      setExpiryHours(24 * 7);
      setCreatedUrl(null);
    }
  }, [open, defaultRecordIds]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      else
        toast({
          title: t("records.sharePack.tooMany", "Pack limit reached"),
          body: t(
            "records.sharePack.tooManyBody",
            "Maximum 50 records per pack. Remove some to add more."
          ),
          tone: "warning",
        });
      return next;
    });
  };

  const submit = async () => {
    try {
      const result = await createPack.mutateAsync({
        recordIds: Array.from(picked),
        label: label || undefined,
        expiresInHours: expiryHours,
      });
      const url = `${(typeof window !== "undefined" && (window as any).location?.origin) || ""}/share/${result.token}`;
      setCreatedUrl(url);
      setStep(3);
      try {
        await RNShare.share({
          message: `${label || "Medical records"}: ${url}`,
          url,
        });
      } catch {
        // user cancelled system share — fine, URL still shown in UI
      }
    } catch (err) {
      toast({
        title: t("records.sharePack.failed", "Failed"),
        body: (err as Error).message,
        tone: "error",
      });
    }
  };

  return (
    <BottomSheet visible={open} onDismiss={onClose} title={t("records.sharePack.title", "Share pack")}>
      <ScrollView contentContainerStyle={styles.body}>
        {step === 1 && (
          <>
            <AppText variant="body.sm" weight="600">
              {t(
                "records.sharePack.step1",
                "Pick records to bundle ({{count}}/50)",
                { count: picked.size }
              )}
            </AppText>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
              {allRecords.map((r: any) => {
                const isPicked = picked.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => toggle(r.id)}
                    style={[
                      styles.row,
                      {
                        backgroundColor: isPicked ? colors.primarySoft : colors.surface,
                        borderColor: isPicked ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="body.sm" weight="600" numberOfLines={1}>
                        {r.title || r.diagnosis || "Untitled"}
                      </AppText>
                      <AppText variant="body.xs" color="muted">
                        {r.kind} • {new Date(r.date ?? r.createdAt).toLocaleDateString()}
                      </AppText>
                    </View>
                    {isPicked && <Check size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
              {allRecords.length === 0 && (
                <AppText variant="body.sm" color="muted">
                  {t("records.sharePack.noRecords", "No records to share yet.")}
                </AppText>
              )}
            </ScrollView>
            <Button
              label={t("records.sharePack.next", "Next")}
              onPress={() => setStep(2)}
              disabled={picked.size === 0}
            />
          </>
        )}

        {step === 2 && (
          <>
            <AppText variant="body.sm" weight="600">
              {t(
                "records.sharePack.step2",
                "Name + expiry ({{count}} records)",
                { count: picked.size }
              )}
            </AppText>
            <FormField label={t("records.sharePack.labelLabel", "Label (optional)")}>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder={t(
                  "records.sharePack.labelPlaceholder",
                  "e.g. Pre-cardiology visit"
                )}
              />
            </FormField>
            <View style={{ gap: 6 }}>
              <AppText variant="caption" weight="700" color="muted">
                {t("records.sharePack.expiryLabel", "EXPIRES IN")}
              </AppText>
              <View style={styles.row}>
                {EXPIRY_CHIPS.map((c) => (
                  <Pill
                    key={c.hours}
                    tone={expiryHours === c.hours ? "info" : "neutral"}
                    onPress={() => setExpiryHours(c.hours)}
                  >
                    {c.label}
                  </Pill>
                ))}
              </View>
            </View>
            <Button
              label={t("records.sharePack.create", "Create share link")}
              onPress={submit}
              loading={createPack.isPending}
            />
            <Button
              label={t("common.back", "Back")}
              variant="ghost"
              onPress={() => setStep(1)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <AppText variant="title.sm">
              {t("records.sharePack.done", "Pack ready")}
            </AppText>
            <AppText variant="body.sm" color="muted">
              {t(
                "records.sharePack.doneBody",
                "Share this URL with your doctor. It expires automatically."
              )}
            </AppText>
            {!!createdUrl && (
              <View
                style={[
                  styles.urlBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <AppText variant="body.sm" selectable>
                  {createdUrl}
                </AppText>
              </View>
            )}
            <Button
              label={t("common.done", "Done")}
              onPress={onClose}
              rightIcon={<ChevronRight size={16} color="#fff" />}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  urlBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
