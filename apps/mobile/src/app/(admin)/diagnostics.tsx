import React, { useState } from "react";
import { View, Text, Alert, ScrollView, StyleSheet } from "react-native";
import {
  FlaskConical,
  Plus,
  Star,
  Power,
  Clock,
  Droplet,
  UtensilsCrossed,
  Flame,
  CheckCircle2,
  SearchX,
} from "lucide-react-native";
import {
  Screen,
  BottomSheet,
  TextInput,
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
  AdminEmpty,
  AdminSection,
  FormGroup,
  FormRow,
  SheetField,
  SheetForm,
  ToggleList,
  MetaTag,
  IconTile,
  SearchBar,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";

const isInactive = (p: any) => p.isActive === 0 || p.isActive === false;

export default function AdminDiagnosticsScreen() {
  const { colors, spacing, typography, shadow } = useTheme();
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

  const all = data?.packages ?? [];
  const activeCount = all.filter((p: any) => !isInactive(p)).length;
  const featuredCount = all.filter((p: any) => p.featured).length;
  const items = all.filter((p: any) => {
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
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingTop: spacing.md }}>
          <AdminHero
            compact
            back
            eyebrow="Directory"
            title="Diagnostics"
            subtitle="Global lab test packages"
            icon={FlaskConical}
            stats={[
              { icon: FlaskConical, value: all.length, label: "Packages" },
              { icon: CheckCircle2, value: activeCount, label: "Active" },
              { icon: Star, value: featuredCount, label: "Featured" },
            ]}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <SearchBar value={q} onChangeText={setQ} placeholder="Search packages" />
          </View>
          <Pressable
            onPress={openCreate}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="New package"
            style={[
              {
                height: 52,
                paddingHorizontal: spacing.lg,
                borderRadius: 26,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.primary,
              },
              shadow.primary,
            ]}
          >
            <Plus size={18} color={colors.onPrimary} strokeWidth={2.6} />
            <Text style={[typography.label.md, { color: colors.onPrimary }]}>New</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <AdminSection
            title="Packages"
            count={debouncedQ ? `${items.length}/${all.length}` : all.length}
          />
          <View style={{ gap: spacing.md }}>
            {isError ? (
              <AdminError
                title="Load failed"
                message="Couldn't load packages."
                onRetry={refetch}
                retrying={isRefetching}
              />
            ) : isLoading ? (
              <ListSkeleton rows={4} />
            ) : all.length === 0 ? (
              <AdminEmpty
                icon={FlaskConical}
                title="No packages yet"
                message="Create the first lab test package patients can book."
                actionLabel="New package"
                onAction={openCreate}
              />
            ) : items.length === 0 ? (
              <AdminEmpty
                icon={SearchX}
                title="No matches"
                message={`Nothing matches “${debouncedQ}”.`}
                actionLabel="Clear search"
                onAction={() => setQ("")}
              />
            ) : (
              items.map((p: any) => (
                <PackageCard
                  key={p.id}
                  p={p}
                  onPress={() => openEdit(p)}
                  onDeactivate={() => onDeactivate(p)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={sheet}
        onDismiss={() => setSheet(false)}
        title={editing ? "Edit package" : "New package"}
        height={700}
      >
        <SheetForm
          submitLabel={editing ? "Save changes" : "Create package"}
          onSubmit={onSave}
          onCancel={() => setSheet(false)}
          loading={save.isPending}
          disabled={!valid}
        >
            <FormGroup title="Basics">
              {!editing ? (
                <SheetField label="Lab partner ID" required>
                  <TextInput
                    value={f.labPartnerId}
                    onChangeText={(v) => setF((p) => ({ ...p, labPartnerId: v }))}
                    autoCapitalize="none"
                    placeholder="Owning lab partner"
                  />
                </SheetField>
              ) : null}
              <SheetField label="Name" required>
                <TextInput
                  value={f.name}
                  onChangeText={(v) => setF((p) => ({ ...p, name: v }))}
                  placeholder="e.g. Essential Health Checkup"
                />
              </SheetField>
              <SheetField label="Slug" required>
                <TextInput
                  value={f.slug}
                  onChangeText={(v) => setF((p) => ({ ...p, slug: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="essential-health-checkup"
                />
              </SheetField>
              <SheetField label="Description">
                <TextInput
                  value={f.description}
                  onChangeText={(v) => setF((p) => ({ ...p, description: v }))}
                  multiline
                  numberOfLines={3}
                  placeholder="What tests are included?"
                  style={{ minHeight: 76, textAlignVertical: "top" }}
                />
              </SheetField>
            </FormGroup>

            <FormGroup title="Pricing">
              <FormRow>
                <SheetField label="Price (LKR)" required>
                  <TextInput
                    value={f.price}
                    onChangeText={(v) => setF((p) => ({ ...p, price: v }))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </SheetField>
                <SheetField label="Discount price">
                  <TextInput
                    value={f.discountPrice}
                    onChangeText={(v) => setF((p) => ({ ...p, discountPrice: v }))}
                    keyboardType="numeric"
                    placeholder="Optional"
                  />
                </SheetField>
              </FormRow>
              {Number(f.discountPrice) > 0 && Number(f.price) > Number(f.discountPrice) ? (
                <Text style={[typography.caption, { color: colors.success, marginTop: -4 }]}>
                  Patients save{" "}
                  {Math.round((1 - Number(f.discountPrice) / Number(f.price)) * 100)}%
                </Text>
              ) : null}
            </FormGroup>

            <FormGroup title="Sample & preparation">
              <FormRow>
                <SheetField label="Category">
                  <TextInput
                    value={f.category}
                    onChangeText={(v) => setF((p) => ({ ...p, category: v }))}
                    placeholder="General"
                  />
                </SheetField>
                <SheetField label="Sample type">
                  <TextInput
                    value={f.sampleType}
                    onChangeText={(v) => setF((p) => ({ ...p, sampleType: v }))}
                    placeholder="Blood, urine…"
                  />
                </SheetField>
              </FormRow>
              <SheetField label="Preparation">
                <TextInput
                  value={f.preparation}
                  onChangeText={(v) => setF((p) => ({ ...p, preparation: v }))}
                  placeholder="e.g. 8h fasting"
                />
              </SheetField>
              <FormRow>
                <SheetField label="Turnaround (hours)">
                  <TextInput
                    value={f.turnaroundHours}
                    onChangeText={(v) => setF((p) => ({ ...p, turnaroundHours: v }))}
                    keyboardType="numeric"
                  />
                </SheetField>
                <SheetField label="Display order">
                  <TextInput
                    value={f.displayOrder}
                    onChangeText={(v) => setF((p) => ({ ...p, displayOrder: v }))}
                    keyboardType="numeric"
                  />
                </SheetField>
              </FormRow>
              <SheetField label="Image URL">
                <TextInput
                  value={f.imageUrl}
                  onChangeText={(v) => setF((p) => ({ ...p, imageUrl: v }))}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://…"
                />
              </SheetField>
            </FormGroup>

            <FormGroup title="Flags">
              <ToggleList
                items={(
                  [
                    ["fastingRequired", "Fasting required", "Patient must fast before sample", UtensilsCrossed],
                    ["popular", "Popular", "Show the “Popular” badge", Flame],
                    ["featured", "Featured", "Pin to the top of the catalogue", Star],
                  ] as const
                ).map(([k, label, hint, icon]) => ({
                  key: k,
                  label,
                  hint,
                  icon,
                  value: f[k] === "yes",
                  onChange: (on: boolean) => setF((p) => ({ ...p, [k]: on ? "yes" : "no" })),
                }))}
              />
            </FormGroup>
        </SheetForm>
      </BottomSheet>
    </Screen>
  );
}

function PackageCard({
  p,
  onPress,
  onDeactivate,
}: {
  p: any;
  onPress: () => void;
  onDeactivate: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const inactive = isInactive(p);
  const price = Number(p.price ?? 0);
  const discount = p.discountPrice != null ? Number(p.discountPrice) : null;
  const hasDiscount = discount != null && discount > 0 && discount < price;
  const pct = hasDiscount ? Math.round((1 - discount! / price) * 100) : 0;

  return (
    <AdminCard onPress={onPress} style={{ padding: 0, opacity: inactive ? 0.7 : 1 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <IconTile icon={FlaskConical} tone={inactive ? "neutral" : "accent"} size={46} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
                numberOfLines={2}
              >
                {p.name}
              </Text>
              {p.featured ? (
                <Star size={13} color={colors.warning} fill={colors.warning} />
              ) : null}
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {p.category || "General"}
              {p.popular ? " · Popular" : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontVariant: ["tabular-nums"] },
              ]}
            >
              LKR {(hasDiscount ? discount! : price).toLocaleString()}
            </Text>
            {hasDiscount ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSubtle, textDecorationLine: "line-through" },
                  ]}
                >
                  {price.toLocaleString()}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 6,
                    height: 18,
                    borderRadius: 9,
                    justifyContent: "center",
                    backgroundColor: colors.successSoft,
                  }}
                >
                  <Text style={[typography.label.xs, { color: colors.success }]}>-{pct}%</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {p.turnaroundHours ? <MetaTag icon={Clock} label={`${p.turnaroundHours}h turnaround`} /> : null}
          {p.sampleType ? <MetaTag icon={Droplet} label={p.sampleType.charAt(0).toUpperCase() + p.sampleType.slice(1)} /> : null}
          {p.fastingRequired ? <MetaTag icon={UtensilsCrossed} label="Fasting" /> : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: spacing.lg,
          paddingRight: spacing.sm,
          paddingVertical: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          <StatusPill status={inactive ? "inactive" : "active"} />
        </View>
        {!inactive ? (
          <Pressable
            onPress={onDeactivate}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`Deactivate ${p.name}`}
            hitSlop={6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 32,
              paddingHorizontal: spacing.md,
              borderRadius: 16,
            }}
          >
            <Power size={14} color={colors.danger} strokeWidth={2.4} />
            <Text style={[typography.label.sm, { color: colors.danger }]}>Deactivate</Text>
          </Pressable>
        ) : (
          <Text style={[typography.caption, { color: colors.textSubtle, paddingRight: spacing.sm }]}>
            Edit to reactivate
          </Text>
        )}
      </View>
    </AdminCard>
  );
}
