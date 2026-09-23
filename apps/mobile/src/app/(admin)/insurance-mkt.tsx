import React, { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import {
  Building2,
  Layers,
  Users,
  Receipt,
  Plus,
  Star,
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
  useInsuranceProviders,
  useSaveInsuranceProvider,
  useInsurancePlans,
  useSaveInsurancePlan,
  useInsuranceEnrollments,
  useInsuranceMktClaims,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  IconTile,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

const SECTIONS = [
  { label: "Providers", value: "providers" },
  { label: "Plans", value: "plans" },
  { label: "Enrollments", value: "enrollments" },
  { label: "Claims", value: "claims" },
];

const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
];

const CLAIM_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Under review", value: "under_review" },
  { label: "Approved", value: "approved", tone: "success" as const },
  { label: "Rejected", value: "rejected", tone: "danger" as const },
  { label: "Paid", value: "paid", tone: "success" as const },
];

const BOOL_OPTS = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

export default function AdminInsuranceMktScreen() {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const [section, setSection] = useState("providers");
  const [claimStatus, setClaimStatus] = useState("all");
  const [planProvider, setPlanProvider] = useState("");

  const providers = useInsuranceProviders();
  const plans = useInsurancePlans(planProvider || undefined);
  const enrollments = useInsuranceEnrollments();
  const mktClaims = useInsuranceMktClaims(claimStatus);

  const saveProvider = useSaveInsuranceProvider();
  const savePlan = useSaveInsurancePlan();

  const [providerSheet, setProviderSheet] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);
  const [editProvider, setEditProvider] = useState<any | null>(null);
  const [editPlan, setEditPlan] = useState<any | null>(null);

  const providerList = providers.data?.providers ?? [];
  const planList = plans.data?.plans ?? [];
  const enrollmentList = enrollments.data?.enrollments ?? [];
  const claimList = mktClaims.data?.claims ?? [];

  const providerOptions = useMemo(
    () => [
      { label: "All providers", value: "" },
      ...providerList.map((p: any) => ({ label: p.name, value: p.id })),
    ],
    [providerList]
  );

  const refetchAll = () => {
    providers.refetch();
    plans.refetch();
    enrollments.refetch();
    mktClaims.refetch();
  };

  const isLoading =
    section === "providers"
      ? providers.isLoading
      : section === "plans"
        ? plans.isLoading
        : section === "enrollments"
          ? enrollments.isLoading
          : mktClaims.isLoading;
  const isError =
    section === "providers"
      ? providers.isError
      : section === "plans"
        ? plans.isError
        : section === "enrollments"
          ? enrollments.isError
          : mktClaims.isError;
  const isRefetching =
    providers.isRefetching ||
    plans.isRefetching ||
    enrollments.isRefetching ||
    mktClaims.isRefetching;

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetchAll}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Directory"
          title="Insurance marketplace"
          subtitle="Providers, plans, enrollments & claims"
          icon={Layers}
          right={
            section === "providers" || section === "plans" ? (
              <Pressable
                onPress={() => {
                  if (section === "providers") {
                    setEditProvider(null);
                    setProviderSheet(true);
                  } else {
                    setEditPlan(null);
                    setPlanSheet(true);
                  }
                }}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={
                  section === "providers" ? "Add provider" : "Add plan"
                }
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
            ) : undefined
          }
          stats={[
            { value: String(providerList.length), label: "Providers" },
            { value: String(planList.length), label: "Plans" },
            { value: String(enrollmentList.length), label: "Enrolled" },
          ]}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <FilterChips options={SECTIONS} value={section} onChange={setSection} />
      </View>
      {section === "plans" ? (
        <FilterChips
          options={providerOptions}
          value={planProvider}
          onChange={setPlanProvider}
          size="sm"
        />
      ) : null}
      {section === "claims" ? (
        <FilterChips
          options={CLAIM_FILTERS}
          value={claimStatus}
          onChange={setClaimStatus}
          size="sm"
        />
      ) : null}

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          marginTop: spacing.sm,
          paddingBottom: spacing.xxl,
        }}
      >
        {isError ? <AdminError message="Couldn't load this section." /> : null}
        {isLoading ? <ListSkeleton rows={6} /> : null}

        {/* ─── Providers ─── */}
        {!isLoading && section === "providers"
          ? providerList.length === 0
            ? !isError && (
                <EmptyState
                  icon={Building2}
                  title="No providers"
                  message="Add the first insurance provider."
                />
              )
            : providerList.map((p: any) => (
                <AdminCard
                  key={p.id}
                  onPress={() => {
                    setEditProvider(p);
                    setProviderSheet(true);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <IconTile icon={Building2} tone="info" size={42} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={[typography.caption, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {p.tagline ?? p.slug}
                        {p.claimSettlementRatioPct != null
                          ? ` · ${p.claimSettlementRatioPct}% claims`
                          : ""}
                      </Text>
                    </View>
                    <StatusPill
                      status={p.isPublished ? "active" : "pending"}
                    />
                  </View>
                </AdminCard>
              ))
          : null}

        {/* ─── Plans ─── */}
        {!isLoading && section === "plans"
          ? planList.length === 0
            ? !isError && (
                <EmptyState
                  icon={Layers}
                  title="No plans"
                  message="Add a plan under a provider."
                />
              )
            : planList.map((p: any) => (
                <AdminCard
                  key={p.id}
                  onPress={() => {
                    setEditPlan(p);
                    setPlanSheet(true);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <IconTile icon={Layers} tone="primary" size={42} />
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
                        {p.isFeatured ? (
                          <Star size={12} color={colors.warning} fill={colors.warning} />
                        ) : null}
                      </View>
                      <Text
                        style={[typography.caption, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {p.planType?.replace(/_/g, " ")} · LKR{" "}
                        {Number(p.monthlyPremiumLkr ?? 0).toLocaleString()}/mo ·
                        cover LKR{" "}
                        {Number(p.coverageSummaryLkr ?? 0).toLocaleString()}
                      </Text>
                    </View>
                    <StatusPill status={p.isPublished ? "active" : "pending"} />
                  </View>
                </AdminCard>
              ))
          : null}

        {/* ─── Enrollments (read-only) ─── */}
        {!isLoading && section === "enrollments"
          ? enrollmentList.length === 0
            ? !isError && (
                <EmptyState
                  icon={Users}
                  title="No enrollments"
                  message="Patient policy enrollments appear here."
                />
              )
            : enrollmentList.map((e: any) => (
                <AdminCard key={e.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <IconTile icon={Users} tone="accent" size={42} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {e.policyNumber ?? "Policy"}
                      </Text>
                      <Text
                        style={[typography.caption, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        User {e.userId?.slice(0, 8)}… · plan{" "}
                        {e.planId?.slice(0, 8)}… ·{" "}
                        {e.createdAt
                          ? fmtDateTime(e.createdAt, locale as any)
                          : ""}
                      </Text>
                    </View>
                    <StatusPill status={e.status ?? "active"} />
                  </View>
                </AdminCard>
              ))
          : null}

        {/* ─── Marketplace claims (read-only) ─── */}
        {!isLoading && section === "claims"
          ? claimList.length === 0
            ? !isError && (
                <EmptyState
                  icon={Receipt}
                  title="No claims"
                  message="Marketplace claims appear here."
                />
              )
            : claimList.map((c: any) => (
                <AdminCard key={c.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <IconTile icon={Receipt} tone="warning" size={42} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[typography.title.sm, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {c.patientName} · {c.treatmentType ?? "claim"}
                      </Text>
                      <Text
                        style={[typography.caption, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {c.providerName} · requested LKR{" "}
                        {Number(c.amountRequestedLkr ?? 0).toLocaleString()}
                        {c.amountApprovedLkr != null
                          ? ` · approved LKR ${Number(c.amountApprovedLkr).toLocaleString()}`
                          : ""}
                      </Text>
                    </View>
                    <StatusPill status={c.status ?? "pending"} />
                  </View>
                </AdminCard>
              ))
          : null}
      </View>

      <ProviderSheet
        visible={providerSheet}
        provider={editProvider}
        saving={saveProvider.isPending}
        onClose={() => setProviderSheet(false)}
        onSave={(body) =>
          saveProvider.mutate(
            { id: editProvider?.id, body },
            {
              onSuccess: () => {
                toast.show("Provider saved", "success");
                setProviderSheet(false);
              },
              onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
            }
          )
        }
      />
      <PlanSheet
        visible={planSheet}
        plan={editPlan}
        providers={providerList}
        saving={savePlan.isPending}
        onClose={() => setPlanSheet(false)}
        onSave={(body) =>
          savePlan.mutate(
            { id: editPlan?.id, body },
            {
              onSuccess: () => {
                toast.show("Plan saved", "success");
                setPlanSheet(false);
              },
              onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
            }
          )
        }
      />
    </Screen>
  );
}

// ─── Provider create/edit sheet ─────────────────────────────

function ProviderSheet({
  visible,
  provider,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  provider: any | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: any) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const [f, setF] = useState<Record<string, string>>({});
  const [published, setPublished] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setF({
        operatorOrgId: provider?.operatorOrgId ?? provider?.operator_org_id ?? "",
        name: provider?.name ?? "",
        slug: provider?.slug ?? "",
        tagline: provider?.tagline ?? "",
        description: provider?.description ?? "",
        regulatorLicense:
          provider?.regulatorLicense ?? provider?.regulator_license ?? "",
        claimSettlementRatioPct: String(
          provider?.claimSettlementRatioPct ??
            provider?.claim_settlement_ratio_pct ??
            ""
        ),
        cashlessHospitalCount: String(
          provider?.cashlessHospitalCount ??
            provider?.cashless_hospital_count ??
            ""
        ),
        websiteUrl: provider?.websiteUrl ?? provider?.website_url ?? "",
        supportPhone: provider?.supportPhone ?? provider?.support_phone ?? "",
      });
      setPublished(!!(provider?.isPublished ?? provider?.is_published));
    }
  }, [visible, provider]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const valid = f.name?.trim() && f.slug?.trim() && (provider || f.operatorOrgId?.trim());

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onClose}
      title={provider ? "Edit provider" : "New provider"}
      height={620}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          {!provider ? (
            <Field label="Operator org ID" required>
              <TextInput
                value={f.operatorOrgId}
                onChangeText={set("operatorOrgId")}
                placeholder="org id (created if missing)"
                autoCapitalize="none"
              />
            </Field>
          ) : null}
          <Field label="Name" required>
            <TextInput value={f.name} onChangeText={set("name")} />
          </Field>
          <Field label="Slug" required hint="lowercase-letters-digits">
            <TextInput
              value={f.slug}
              onChangeText={set("slug")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="Tagline">
            <TextInput value={f.tagline} onChangeText={set("tagline")} />
          </Field>
          <Field label="Description">
            <TextInput
              value={f.description}
              onChangeText={set("description")}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
          </Field>
          <Field label="Regulator license">
            <TextInput
              value={f.regulatorLicense}
              onChangeText={set("regulatorLicense")}
            />
          </Field>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Claim ratio %">
                <TextInput
                  value={f.claimSettlementRatioPct}
                  onChangeText={set("claimSettlementRatioPct")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cashless hospitals">
                <TextInput
                  value={f.cashlessHospitalCount}
                  onChangeText={set("cashlessHospitalCount")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <Field label="Website">
            <TextInput
              value={f.websiteUrl}
              onChangeText={set("websiteUrl")}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
          <Field label="Support phone">
            <TextInput
              value={f.supportPhone}
              onChangeText={set("supportPhone")}
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="Published">
            <ChipGroup
              options={BOOL_OPTS}
              value={published ? "yes" : "no"}
              onChange={(v: string) => setPublished(v === "yes")}
            />
          </Field>
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={provider ? "Save changes" : "Create provider"}
              loading={saving}
              disabled={!valid}
              onPress={() =>
                onSave({
                  ...(provider ? {} : { operatorOrgId: f.operatorOrgId.trim() }),
                  name: f.name.trim(),
                  slug: f.slug.trim(),
                  tagline: f.tagline.trim() || undefined,
                  description: f.description.trim() || undefined,
                  regulatorLicense: f.regulatorLicense.trim() || undefined,
                  claimSettlementRatioPct: num(f.claimSettlementRatioPct),
                  cashlessHospitalCount: num(f.cashlessHospitalCount),
                  websiteUrl: f.websiteUrl.trim() || undefined,
                  supportPhone: f.supportPhone.trim() || undefined,
                  isPublished: published,
                })
              }
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Plan create/edit sheet ─────────────────────────────────

function PlanSheet({
  visible,
  plan,
  providers,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  plan: any | null;
  providers: any[];
  saving: boolean;
  onClose: () => void;
  onSave: (body: any) => void;
}) {
  const { spacing } = useTheme();
  const [f, setF] = useState<Record<string, string>>({});
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setF({
        providerId: plan?.providerId ?? plan?.provider_id ?? "",
        name: plan?.name ?? "",
        slug: plan?.slug ?? "",
        planType: plan?.planType ?? plan?.plan_type ?? "individual",
        coverageSummaryLkr: String(
          plan?.coverageSummaryLkr ?? plan?.coverage_summary_lkr ?? ""
        ),
        monthlyPremiumLkr: String(
          plan?.monthlyPremiumLkr ?? plan?.monthly_premium_lkr ?? ""
        ),
        annualPremiumLkr: String(
          plan?.annualPremiumLkr ?? plan?.annual_premium_lkr ?? ""
        ),
        deductibleLkr: String(
          plan?.deductibleLkr ?? plan?.deductible_lkr ?? "0"
        ),
        copayPct: String(plan?.copayPct ?? plan?.copay_pct ?? "10"),
        waitingPeriodDays: String(
          plan?.waitingPeriodDays ?? plan?.waiting_period_days ?? "30"
        ),
        termMonths: String(plan?.termMonths ?? plan?.term_months ?? "12"),
      });
      setPublished(!!(plan?.isPublished ?? plan?.is_published));
      setFeatured(!!(plan?.isFeatured ?? plan?.is_featured));
    }
  }, [visible, plan]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const providerOpts = providers.map((p: any) => ({
    label: p.name,
    value: p.id,
  }));

  const valid =
    f.providerId &&
    f.name?.trim() &&
    f.slug?.trim() &&
    Number(f.coverageSummaryLkr) > 0 &&
    Number(f.monthlyPremiumLkr) > 0 &&
    Number(f.annualPremiumLkr) > 0;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onClose}
      title={plan ? "Edit plan" : "New plan"}
      height={640}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Field label="Provider" required>
            <ChipGroup
              options={providerOpts}
              value={f.providerId}
              onChange={(v: string) => set("providerId")(v)}
            />
          </Field>
          <Field label="Name" required>
            <TextInput value={f.name} onChangeText={set("name")} />
          </Field>
          <Field label="Slug" required>
            <TextInput
              value={f.slug}
              onChangeText={set("slug")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="Plan type" required>
            <ChipGroup
              options={PLAN_TYPES.map((t) => ({
                label: t.replace(/_/g, " "),
                value: t,
              }))}
              value={f.planType}
              onChange={(v: string) => set("planType")(v)}
            />
          </Field>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Coverage LKR" required>
                <TextInput
                  value={f.coverageSummaryLkr}
                  onChangeText={set("coverageSummaryLkr")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Deductible">
                <TextInput
                  value={f.deductibleLkr}
                  onChangeText={set("deductibleLkr")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Monthly premium" required>
                <TextInput
                  value={f.monthlyPremiumLkr}
                  onChangeText={set("monthlyPremiumLkr")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Annual premium" required>
                <TextInput
                  value={f.annualPremiumLkr}
                  onChangeText={set("annualPremiumLkr")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Copay %">
                <TextInput
                  value={f.copayPct}
                  onChangeText={set("copayPct")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Wait days">
                <TextInput
                  value={f.waitingPeriodDays}
                  onChangeText={set("waitingPeriodDays")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Term (mo)">
                <TextInput
                  value={f.termMonths}
                  onChangeText={set("termMonths")}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <Field label="Published">
            <ChipGroup
              options={BOOL_OPTS}
              value={published ? "yes" : "no"}
              onChange={(v: string) => setPublished(v === "yes")}
            />
          </Field>
          <Field label="Featured">
            <ChipGroup
              options={BOOL_OPTS}
              value={featured ? "yes" : "no"}
              onChange={(v: string) => setFeatured(v === "yes")}
            />
          </Field>
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={plan ? "Save changes" : "Create plan"}
              loading={saving}
              disabled={!valid}
              onPress={() =>
                onSave({
                  providerId: f.providerId,
                  name: f.name.trim(),
                  slug: f.slug.trim(),
                  planType: f.planType,
                  coverageSummaryLkr: num(f.coverageSummaryLkr),
                  monthlyPremiumLkr: num(f.monthlyPremiumLkr),
                  annualPremiumLkr: num(f.annualPremiumLkr),
                  deductibleLkr: num(f.deductibleLkr),
                  copayPct: num(f.copayPct),
                  waitingPeriodDays: num(f.waitingPeriodDays),
                  termMonths: num(f.termMonths),
                  isPublished: published,
                  isFeatured: featured,
                })
              }
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
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
        {required ? " *" : ""}
        {hint ? `  (${hint})` : ""}
      </Text>
      {children}
    </View>
  );
}
