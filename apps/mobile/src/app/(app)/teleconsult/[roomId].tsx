// @ts-nocheck

/**
 * /teleconsult/[roomId] — Patient's video consult surface.
 *
 * Maps roomId → sessionId via GET /teleconsult/sessions/me/active, then
 * renders <TeleconsultRoom> with a collapsible bottom drawer that
 * shows the patient's own records and active prescriptions. The
 * drawer is non-interactive while connected (read-only during call);
 * the doctor is the one writing prescriptions / notes via the portal.
 *
 * Auth: standard mobile Bearer token + (this endpoint mints) a
 * purpose-scoped WSS ticket because RN's WebSocket can't ride the
 * SecureStore JWT via cookies.
 */

import { use, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
} from "lucide-react-native";

import TeleconsultRoom from "@/components/teleconsult/TeleconsultRoom";
import { api, getApiBaseUrl } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { useHealthSummary } from "@/hooks/useApi";
import { useMyPrescriptions } from "@/hooks/useApi";

interface ActiveSessionResp {
  session: {
    id: string;
    roomId: string;
    status: string;
    appointmentId: string;
    createdAt: string;
  } | null;
}

export default function TeleconsultPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, radius, spacing, typography } = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tab, setTab] = useState<"records" | "prescriptions">("records");
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active: ActiveSessionResp = await api(
          "/teleconsult/sessions/me/active"
        );
        if (cancelled) return;
        if (!active.session || active.session.roomId !== roomId) {
          setError(t("consult.waitingForDoctor"));
          setLoading(false);
          return;
        }
        setSessionId(active.session.id);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || t("consult.connectionLost"));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, t]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
          {t("consult.connecting")}
        </Text>
      </View>
    );
  }

  if (error || !sessionId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {t("consult.waitingForDoctor")}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {error}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 22,
            paddingVertical: 10,
            borderRadius: radius.lg,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {t("consult.leave")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Top: video stage */}
      <View style={{ flex: 1 }}>
        <TeleconsultRoom sessionId={sessionId} apiBase={apiBase} />
      </View>

      {/* Bottom: records drawer */}
      <RecordsDrawer
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        tab={tab}
        onTab={setTab}
      />
    </View>
  );
}

interface DrawerProps {
  open: boolean;
  onToggle: () => void;
  tab: "records" | "prescriptions";
  onTab: (t: "records" | "prescriptions") => void;
}

function RecordsDrawer({ open, onToggle, tab, onTab }: DrawerProps) {
  const { t } = useTranslation();
  const { colors, radius, spacing, typography } = useTheme();
  const summary = useHealthSummary();
  const prescriptions = useMyPrescriptions();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        maxHeight: open ? "55%" : 56,
        overflow: "hidden",
      }}
    >
      {/* Handle + tabs */}
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          borderBottomWidth: open ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          <Text
            style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}
          >
            {tab === "records"
              ? t("consult.tabs.records")
              : t("consult.tabs.prescriptions")}
          </Text>
        </View>
        {open ? (
          <ChevronDown size={18} color={colors.textMuted} />
        ) : (
          <ChevronUp size={18} color={colors.textMuted} />
        )}
      </Pressable>

      {open ? (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
            }}
          >
            {(
              [
                { key: "records", label: t("consult.tabs.records"), Icon: FileText },
                {
                  key: "prescriptions",
                  label: t("consult.tabs.prescriptions"),
                  Icon: Pill,
                },
              ] as { key: "records" | "prescriptions"; label: string; Icon: any }[]
            ).map(({ key, label, Icon }) => (
              <Pressable
                key={key}
                onPress={() => onTab(key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.md,
                  backgroundColor:
                    tab === key ? colors.primary : colors.surface2,
                }}
              >
                <Icon
                  size={13}
                  color={tab === key ? "#fff" : colors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: tab === key ? "#fff" : colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.md }}
          >
            {tab === "records" ? (
              summary.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : summary.isError ? (
                <Text
                  style={[typography.body.sm, { color: colors.textMuted }]}
                >
                  Couldn't load records.
                </Text>
              ) : (
                <RecordsView summary={summary.data} />
              )
            ) : prescriptions.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <PrescriptionsView data={prescriptions.data} />
            )}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

function RecordsView({ summary }: { summary: any }) {
  const { colors, typography, spacing } = useTheme();
  if (!summary) return null;
  return (
    <View style={{ gap: spacing.md }}>
      {summary.allergies?.length ? (
        <Block title="Allergies">
          {summary.allergies.map((a: any, i: number) => (
            <Text
              key={i}
              style={[
                typography.body.sm,
                { color: colors.text, marginBottom: 2 },
              ]}
            >
              • {a.substance}
              {a.severity ? ` (${a.severity})` : ""}
            </Text>
          ))}
        </Block>
      ) : null}
      {summary.conditions?.length ? (
        <Block title="Active conditions">
          {summary.conditions.map((c: any, i: number) => (
            <Text
              key={i}
              style={[
                typography.body.sm,
                { color: colors.text, marginBottom: 2 },
              ]}
            >
              • {c.name}
            </Text>
          ))}
        </Block>
      ) : null}
      {summary.activeMeds?.length ? (
        <Block title="Active medicines">
          {summary.activeMeds.map((m: any, i: number) => (
            <Text
              key={i}
              style={[
                typography.body.sm,
                { color: colors.text, marginBottom: 2 },
              ]}
            >
              • {m.name}
              {m.dosage ? ` ${m.dosage}` : ""}
            </Text>
          ))}
        </Block>
      ) : null}
      {!summary.allergies?.length &&
      !summary.conditions?.length &&
      !summary.activeMeds?.length ? (
        <Text style={[typography.body.sm, { color: colors.textMuted }]}>
          No records to show yet.
        </Text>
      ) : null}
    </View>
  );
}

function PrescriptionsView({ data }: { data: any }) {
  const { colors, typography, spacing } = useTheme();
  const list: any[] = data?.prescriptions ?? data?.items ?? data ?? [];
  if (!list.length) {
    return (
      <Text style={[typography.body.sm, { color: colors.textMuted }]}>
        No active prescriptions.
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {list.slice(0, 20).map((p: any) => (
        <View
          key={p.id ?? p.prescriptionId ?? JSON.stringify(p)}
          style={{
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={[typography.body.md, { color: colors.text, fontWeight: "600" }]}>
            {p.diagnosis ?? p.title ?? p.medicationName ?? "Prescription"}
          </Text>
          <Text style={[typography.body.sm, { color: colors.textMuted }]}>
            {p.date ?? p.createdAt ?? ""} · {p.status ?? ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View>
      <Text
        style={[
          typography.overline,
          { color: colors.textMuted, marginBottom: 4 },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}