import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Stethoscope, Search, Check } from "lucide-react-native";
import { useAddCareTeamMember } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  TextInput,
  Pill,
  useToast,
} from "@/components/ui";
import type { PillTone } from "@/components/ui/Pill";

type DoctorHit = {
  doctorId: string;
  name: string;
  specialization: string;
  hospitalName: string | null;
  rating: number | null;
};

const ROLES = [
  "primary_care",
  "specialist",
  "covering",
  "on_call",
  "family_view",
] as const;

const SCOPES = ["full", "episodes_only", "records_only"] as const;

const ROLE_TONE: Record<string, PillTone> = {
  primary_care: "success",
  specialist: "primary",
  covering: "warning",
  on_call: "info",
  family_view: "danger",
};

export default function CareTeamAddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DoctorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DoctorHit | null>(null);
  const [role, setRole] = useState<(typeof ROLES)[number]>("primary_care");
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("full");
  const add = useAddCareTeamMember();

  const search = async () => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api<{ doctors: DoctorHit[] }>(
        `/doctor/search?query=${encodeURIComponent(q.trim())}`
      );
      setHits(res.doctors ?? []);
    } catch (e: any) {
      toast.show(e?.message ?? "Search failed", "danger");
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!selected) return;
    try {
      await add.mutateAsync({
        doctorId: selected.doctorId,
        role,
        scope,
      });
      toast.show(t("careTeam.added"), "success");
      router.back();
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("already exists")) {
        toast.show(t("careTeam.alreadyAdded"), "info");
      } else {
        toast.show(msg, "danger");
      }
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={t("careTeam.addTitle")}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={search}
          placeholder={t("careTeam.searchPlaceholder")}
          leadingIcon={Search}
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
        />

        {searching ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : hits.length === 0 && q.length >= 2 ? (
          <Text
            style={{
              color: colors.textMuted,
              textAlign: "center",
              marginTop: 16,
            }}
          >
            {t("careTeam.noResults")}
          </Text>
        ) : null}

        {hits.map((h) => (
          <Pressable
            key={h.doctorId}
            onPress={() => setSelected(h)}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor:
                selected?.doctorId === h.doctorId
                  ? colors.surfaceMuted
                  : colors.surface,
              borderWidth: 1,
              borderColor:
                selected?.doctorId === h.doctorId
                  ? colors.accent
                  : colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Stethoscope size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                  {h.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  {h.specialization}
                  {h.hospitalName ? ` · ${h.hospitalName}` : ""}
                </Text>
              </View>
              {selected?.doctorId === h.doctorId && (
                <Check size={18} color={colors.accent} />
              )}
            </View>
          </Pressable>
        ))}

        {selected && (
          <Card style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginBottom: 8,
              }}
            >
              {t("careTeam.roleLabel")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => (
                <Pressable key={r} onPress={() => setRole(r)}>
                  <Pill
                    label={t(`careTeam.role.${r}`)}
                    tone={role === r ? ROLE_TONE[r] : "neutral"}
                  />
                </Pressable>
              ))}
            </View>

            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              {t("careTeam.scopeLabel")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SCOPES.map((s) => (
                <Pressable key={s} onPress={() => setScope(s)}>
                  <Pill
                    label={t(`careTeam.scope.${s}`)}
                    tone={scope === s ? "success" : "neutral"}
                  />
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        <View style={{ marginTop: 32 }}>
          <Button
            title={t("careTeam.confirmAdd")}
            onPress={submit}
            disabled={!selected}
            loading={add.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}