// @ts-nocheck
// Phase MTN-1 mobile: "New clinic" form. POST /clinics auto-inserts the
// caller as owner with 100% ownership.

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Building2, MapPin, Phone, Plus, Sparkles, Stethoscope } from "lucide-react-native";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  FormField,
  TextInput,
  Button,
  IconTile,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";

export default function NewClinic() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError(t("doctorClinicNew.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/clinics", {
        method: "POST",
        body: {
          name: name.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          specializations: specializations
            ? specializations
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        },
      });
      router.back();
    } catch (e: any) {
      setError(e?.message || t("doctorClinicNew.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("doctorClinicNew.title")}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.lg }}
      >
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <IconTile icon={Stethoscope} tone="accent" appearance="solid" size={30} />
            <Text style={[typography.title.md, { color: colors.text }]}>
              {t("doctorClinicNew.title")}
            </Text>
          </View>
          <FormField label={t("doctorClinicNew.name")} required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("doctorClinicNew.namePlaceholder")}
              leadingIcon={Building2}
            />
          </FormField>
          <FormField label={t("doctorClinicNew.address")}>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t("doctorClinicNew.addressPlaceholder")}
              leadingIcon={MapPin}
              multiline
            />
          </FormField>
          <FormField label={t("doctorClinicNew.phone")}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("doctorClinicNew.phonePlaceholder")}
              leadingIcon={Phone}
              keyboardType="phone-pad"
            />
          </FormField>
          <FormField label={t("doctorClinicNew.specializations")}>
            <TextInput
              value={specializations}
              onChangeText={setSpecializations}
              placeholder={t("doctorClinicNew.specializationsPlaceholder")}
              leadingIcon={Sparkles}
            />
          </FormField>
          {error ? <Pill label={error} tone="danger" /> : null}
        </Card>
        <Button
          title={t("doctorClinicNew.create")}
          onPress={submit}
          loading={busy}
          icon={Plus}
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
