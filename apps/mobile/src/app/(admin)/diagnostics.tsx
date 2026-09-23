import React, { useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import {
  FlaskConical,
  Plus,
  Star,
  Ban,
} from "lucide-react-native";
import {
  Screen,
  Button,
  BottomSheet,
  TextInput,
  ChipGroup,
  EmptyState,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useDiagnosticsPackages,
  useSaveDiagnosticsPackage,
  useDeactivateDiagnosticsPackage,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  IconTile,
  SearchBar,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";

const BOOL_OPTS = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

export default function AdminDiagnosticsScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const { data, isLoading, isError, refetch, isRefetching } =
    useDiagnosticsPackages();
  const save = useSaveDiagnosticsPackage();
  const deactivate = useDeactivateDiagnosticsPackage();

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<Record<string, string>>({});

  const items = (data?.packages ?? []).filter((p: any) => {
    if (!debouncedQ) return true;
    const needle = debouncedQ.toLowerCase();
    return (
      p.name?.toLowerCase().includes(needle) ||
      p.slug?.toLowerCase().includes(needle) ||
      p.category?.toLowerCase().includes(needle)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setF({
      name: "", slug: "", description: "", price: "", discountPrice: "",
      labPartnerId: "", category: "", preparation: "", sampleType: "",
      imageUrl: "", displayOrder: "0", turnaroundHours: "48",
      instructions: "", fastingRequired: "no", popular: "no", featured: "no",
    });
    setSheet(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setF({
      name: p.name ?? "",
      slug: p.slug ?? "",
      description: p.description ?? "",
      price: String(p.price ?? ""),
      discountPrice: p.discountPrice != null ? String(p.discountPrice) : "",
      labPartnerId: p.labPartnerId ?? "",
      category: p.category ?? "",
      preparation: p.preparation ?? "",
      sampleType: p.sampleType ?? "",
      imageUrl: p.imageUrl ?? "",
      displayOrder: String(p.displayOrder ?? 0),
      turnaroundHours: String(p.turnaroundHours ?? 48),
      instructions: p.instructions ?? "",
      fastingRequired: p.fastingRequired ? "yes" : "no",
      popular: p.popular ? "yes" : "no",
      featured: p.featured ? "yes" : "no",
    });
    setSheet(true);
  };

  const onSave = () => {
    const body: any = {
      name: f.name.trim(),
      slug: f.slug.trim(),
      description: f.description.trim() || undefined,
      price: Number(f.price),
      discountPrice: f.discountPrice ? Number(f.discountPrice) : undefined,
      category: f.category.trim() || undefined,
      preparation: f.preparation.trim() || undefined,
      fastingRequired: f.fastingRequired === "yes",
      sampleType: f.sampleType.trim() || undefined,
      imageUrl: f.imageUrl.trim() || undefined,
      popular: f.popular === "yes",
      featured: f.featured === "yes",
      displayOrder: Number(f.displayOrder) || 0,
      turnaroundHours: Number(f.turnaroundHours) || 48,
      instructions: f.instructions.trim() || undefined,
    };
    if (!editing) body.labPartnerId = f.labPartnerId.trim();
    save.mutate(
      { id: editing?.id, body },
      {
        onSuccess: () => {
          toast.show(editing ? "Package updated" : "Package created", "success");
          setSheet(false);
        },
        onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
      }
    );
  };

  const onDeactivate = (p: any) => {
    Alert.alert(
      "Deactivate package",
      `"${p.name}" will be hidden from booking. You can reactivate it by editing.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () =>
            deactivate.mutate(p.id, {
              onSuccess: () => toast.show("Package deactivated", "success"),
              onError: (e: any) =>
                toast.show(e?.message ?? "Failed", "danger"),
            }),
        },
      ]
    );
  };

  const valid =
    f.name?.trim() && f.slug?.trim() && Number(f.price) > 0 &&
    (editing || f.labPartnerId?.trim());

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Directory"
          title="Diagnostics packages"
          subtitle={`${data?.packages?.length ?? 0} global lab test packages`}
          icon={FlaskConical}
          right={
            <Pressable
              onPress={openCreate}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Add package"
              hitSlop={8}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          }
        />
      </View>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginTop: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <SearchBar value={q} onChangeText={setQ} placeholder="Search packages" />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 140,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {isError ? <AdminError message="Couldn't load packages." /> : null}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No packages"
            message="Create the first diagnostics package."
          />
        ) : (
          items.map((p: any) => (
            <AdminCard key={p.id} onPress={() => openEdit(p)}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <IconTile icon={FlaskConical} tone="accent" size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[typography.title.sm, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    {p.featured ? (
                      <Star size={12} color={colors.warning} fill={colors.warning} />
                    ) : null}
                  </View>
                  <Text
                    style={[typography.caption, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {p.category ?? "General"} · LKR{" "}
                    {Number(p.discountPrice ?? p.price ?? 0).toLocaleString()}
                    {p.discountPrice
                      ? `  (was ${Number(p.price).toLocaleString()})`
                      : ""}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 5,
                      alignItems: "center",
                    }}
                  >
                    <StatusPill
                      status={p.isActive === 0 || p.isActive === false ? "suspended" : "active"}
                    />
                    {p.turnaroundHours ? (
                      <Text
                        style={[typography.caption, { color: colors.textSubtle }]}
                      >
                        {p.turnaroundHours}h TAT
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Button
                  title="Off"
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  icon={Ban}
                  onPress={() => onDeactivate(p)}
                />
              </View>
            </AdminCard>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={sheet}
        onDismiss={() => setSheet(false)}
        title={editing ? "Edit package" : "New package"}
        height={640}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            {!editing ? (
              <Field label="Lab partner ID" req>
                <TextInput
                  value={f.labPartnerId}
                  onChangeText={(v) => setF((p) => ({ ...p, labPartnerId: v }))}
                  autoCapitalize="none"
                  placeholder="Owning lab partner"
                />
              </Field>
            ) : null}
            <Field label="Name" req>
              <TextInput
                value={f.name}
                onChangeText={(v) => setF((p) => ({ ...p, name: v }))}
              />
            </Field>
            <Field label="Slug" req>
              <TextInput
                value={f.slug}
                onChangeText={(v) => setF((p) => ({ ...p, slug: v }))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Price LKR" req>
                  <TextInput
                    value={f.price}
                    onChangeText={(v) => setF((p) => ({ ...p, price: v }))}
                    keyboardType="numeric"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Discount price">
                  <TextInput
                    value={f.discountPrice}
                    onChangeText={(v) =>
                      setF((p) => ({ ...p, discountPrice: v }))
                    }
                    keyboardType="numeric"
                  />
                </Field>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Category">
                  <TextInput
                    value={f.category}
                    onChangeText={(v) => setF((p) => ({ ...p, category: v }))}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Sample type">
                  <TextInput
                    value={f.sampleType}
                    onChangeText={(v) => setF((p) => ({ ...p, sampleType: v }))}
                    placeholder="blood, urine…"
                  />
                </Field>
              </View>
            </View>
            <Field label="Description">
              <TextInput
                value={f.description}
                onChangeText={(v) => setF((p) => ({ ...p, description: v }))}
                multiline
                numberOfLines={2}
              />
            </Field>
            <Field label="Preparation">
              <TextInput
                value={f.preparation}
                onChangeText={(v) => setF((p) => ({ ...p, preparation: v }))}
                placeholder="e.g. 8h fasting"
              />
            </Field>
            <Field label="Image URL">
              <TextInput
                value={f.imageUrl}
                onChangeText={(v) => setF((p) => ({ ...p, imageUrl: v }))}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://…"
              />
            </Field>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="TAT hours">
                  <TextInput
                    value={f.turnaroundHours}
                    onChangeText={(v) =>
                      setF((p) => ({ ...p, turnaroundHours: v }))
                    }
                    keyboardType="numeric"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Display order">
                  <TextInput
                    value={f.displayOrder}
                    onChangeText={(v) =>
                      setF((p) => ({ ...p, displayOrder: v }))
                    }
                    keyboardType="numeric"
                  />
                </Field>
              </View>
            </View>
            {(
              [
                ["fastingRequired", "Fasting required"],
                ["popular", "Popular"],
                ["featured", "Featured"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <ChipGroup
                  options={BOOL_OPTS}
                  value={f[k] ?? "no"}
                  onChange={(v: string) => setF((p) => ({ ...p, [k]: v }))}
                />
              </Field>
            ))}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                title={editing ? "Save changes" : "Create package"}
                onPress={onSave}
                loading={save.isPending}
                disabled={!valid}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setSheet(false)}
              />
            </View>
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function Field({
  label,
  req,
  children,
}: {
  label: string;
  req?: boolean;
  children: React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  return (
    <View>
      <Text
        style={[
          typography.caption,
          {
            color: colors.textMuted,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          },
        ]}
      >
        {label}
        {req ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}
