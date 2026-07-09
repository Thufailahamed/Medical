// @ts-nocheck

// Patient-visible access log. Shows every PHI access against the
// caller's record in the recent past so the patient can spot anything
// unexpected. Same payload as the web `/audit/me` route — the server
// filters rows so only entries where the patient is the resource
// owner are returned.

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { ScrollText } from "lucide-react-native";

import { api } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { intlLocale } from "@/lib/format";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorName?: string | null;
  details: string | null;
  createdAt: string;
}

function fmtTime(d: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale as any), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(d));
  } catch {
    return d;
  }
}

export default function AuditLogScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", "me"],
    queryFn: () => api<{ entries: AuditEntry[] }>("/audit/me?limit=200"),
  });

  const entries = data?.entries ?? [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
      />

      {error ? (
        <Card padded>
          <PillCmp label={t("audit.loadError")} tone="danger" />
        </Card>
      ) : isLoading ? (
        <Card padded={false}>
          <View
            style={{
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
            <Skeleton height={56} radius={14} />
          </View>
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t("audit.emptyTitle")}
          message={t("audit.emptyBody")}
        />
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.sm,
          }}
        >
          {entries.map((e) => (
            <Card key={e.id} padded>
              <View style={{ gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    flexWrap: "wrap",
                  }}
                >
                  <PillCmp label={e.action} tone="accent" size="sm" />
                  <PillCmp label={e.resource} tone="neutral" size="sm" />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                  }}
                >
                  <PillCmp
                    label={e.actorName || e.actorId || t("audit.actorSystem")}
                    tone="muted"
                    size="sm"
                  />
                  <PillCmp
                    label={fmtTime(e.createdAt, "en")}
                    tone="muted"
                    size="sm"
                  />
                </View>
                {e.details ? (
                  <PillCmp
                    label={e.details}
                    tone="muted"
                    size="sm"
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
