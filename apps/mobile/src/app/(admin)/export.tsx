import React, { useState } from "react";
import { View, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  Download,
  FileSpreadsheet,
  Users,
  ClipboardList,
  UserCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react-native";
import { Screen, Pressable, useToast } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  IconTile,
  InfoPanel,
} from "@/components/admin/ui";

// ADM-10 exports. We fetch the raw Response (the api() helper always
// parses JSON), write the CSV/NDJSON payload to the cache, then hand it
// to the OS share sheet — parity with the web "download" buttons.

type ExportDef = {
  key: string;
  label: string;
  desc: string;
  path: string;
  filename: string;
  icon: LucideIcon;
};

const EXPORTS: ExportDef[] = [
  {
    key: "users",
    label: "Users",
    desc: "All user accounts · CSV",
    path: "/admin/export/users?format=csv",
    filename: "users.csv",
    icon: Users,
  },
  {
    key: "audit",
    label: "Audit log",
    desc: "Admin actions · CSV (5k rows)",
    path: "/admin/export/audit?format=csv",
    filename: "audit.csv",
    icon: ScrollText,
  },
  {
    key: "approvals",
    label: "Approvals",
    desc: "Approval queue · CSV",
    path: "/admin/export/approvals?format=csv",
    filename: "approvals.csv",
    icon: UserCheck,
  },
  {
    key: "notes",
    label: "Admin notes",
    desc: "Internal user notes · CSV",
    path: "/admin/export/notes",
    filename: "notes.csv",
    icon: ClipboardList,
  },
];

export default function AdminExportScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const doExport = async (def: ExportDef) => {
    setBusy(def.key);
    try {
      // api() attaches the auth token + step-up-agnostic headers; "blob"
      // returns the raw payload so CSV/NDJSON never hits the JSON parser.
      const blob = await api<Blob>(def.path, { responseType: "blob" });
      const text = await blob.text();
      if (!text.trim()) throw new Error("Export returned no data");

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) throw new Error("Cache directory unavailable");

      const fileUri = `${cacheDir}${def.filename}`;
      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: def.filename.endsWith(".csv")
            ? "text/csv"
            : "application/x-ndjson",
          dialogTitle: `Export ${def.label}`,
        });
      } else {
        await Clipboard.setStringAsync(text);
        toast.show(`${def.label} copied to clipboard`, "success");
      }
    } catch (e: any) {
      toast.show(e?.message ?? "Export failed", "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="System"
          title="Exports"
          subtitle="Download admin data snapshots"
          icon={Download}
          stats={[{ value: String(EXPORTS.length), label: "Datasets" }]}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <InfoPanel
          icon={FileSpreadsheet}
          tone="accent"
          title="How exports work"
        >
          <Text
            style={[
              typography.caption,
              { color: colors.textMuted, lineHeight: 18 },
            ]}
          >
            Exports stream server-side. On device they're saved to the app
            cache and opened in the share sheet — save to Files, AirDrop, or
            send to yourself.
          </Text>
        </InfoPanel>

        <View>
          <AdminSection title="Datasets" count={EXPORTS.length} />
          <View style={{ gap: spacing.sm }}>
            {EXPORTS.map((def) => {
              return (
                <Pressable
                  key={def.key}
                  onPress={() => doExport(def)}
                  haptic="light"
                  disabled={busy !== null}
                  accessibilityRole="button"
                >
                  <AdminCard>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                      }}
                    >
                      <IconTile icon={def.icon} tone="primary" size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            typography.title.sm,
                            { color: colors.text },
                          ]}
                        >
                          {def.label}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted },
                          ]}
                        >
                          {def.desc}
                        </Text>
                      </View>
                      {busy === def.key ? (
                        <Download size={18} color={colors.primary} />
                      ) : (
                        <FileSpreadsheet size={18} color={colors.textSubtle} />
                      )}
                    </View>
                  </AdminCard>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text
          style={[
            typography.caption,
            {
              color: colors.textSubtle,
              textAlign: "center",
              marginTop: spacing.sm,
            },
          ]}
        >
          Every export is recorded in the audit log.
        </Text>
      </View>
    </Screen>
  );
}
