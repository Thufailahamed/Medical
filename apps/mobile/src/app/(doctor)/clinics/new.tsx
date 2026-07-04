// @ts-nocheck
// Phase MTN-1 mobile: "New clinic" form. POST /clinics auto-inserts the
// caller as owner with 100% ownership.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Screen, Card, Pill } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";

export default function NewClinic() {
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
      setError("Clinic name is required");
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
      setError(e?.message || "Failed to create clinic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={{
            marginBottom: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "600" }}>Back</Text>
        </Pressable>
        <Text
          style={[
            typography.title.lg,
            { color: colors.text, fontWeight: "800", marginBottom: spacing.md },
          ]}
        >
          New Clinic
        </Text>

        <Card style={{ gap: spacing.md }}>
          <Field
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Sunrise Family Clinic"
          />
          <Field
            label="Address"
            value={address}
            onChange={setAddress}
            placeholder="Street, city"
            multiline
          />
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+91…"
            keyboardType="phone-pad"
          />
          <Field
            label="Specializations (comma-separated)"
            value={specializations}
            onChange={setSpecializations}
            placeholder="GP, Pediatrics"
          />
          {error ? <Pill label={error} tone="danger" /> : null}
          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primarySoft : colors.primary,
              paddingVertical: spacing.md,
              borderRadius: 12,
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={{ color: colors.onPrimary, fontWeight: "800" }}>
                Create clinic
              </Text>
            )}
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View>
      <Text
        style={[
          typography.label.md,
          { color: colors.textMuted, marginBottom: 4 },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.sm : spacing.md,
          color: colors.text,
          minHeight: multiline ? 80 : undefined,
        }}
      />
    </View>
  );
}