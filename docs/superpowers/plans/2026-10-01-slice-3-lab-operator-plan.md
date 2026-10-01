# Slice 3: Lab + Insurance-Operator Portals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `(lab)` and `(operator)` mobile groups — web parity for `lab-portal/(portal)/` (dashboard, bookings, catalog, packages, phlebotomists) and `insurance-operator/(portal)/` (dashboard, claims, enrollments). No native deps.

**Architecture:** New hooks in `useApi.ts` for `/lab-portal/*` (role `laboratory`) and `/insurance-operator/*` (role `insurance` + `operatorOrgId`; unbound users get 403 "No operator org" → error state). Two tab groups with `IslandTabBar`: lab = Home/Bookings/Catalog(+packages)/Team; operator = Home/Claims/Enrollments; details hidden push routes. Roles wired into `homeForRole`/`groupForRole` + register (backend `/auth/register` accepts both).

**Tech Stack:** Expo SDK 52, RN 0.76, expo-router, TanStack Query v5, existing `@/components/ui` primitives.

## Global Constraints

- Tokens via `useTheme()`; no hardcoded brand colors; `shadow.*` only; `colors.hairline` edges.
- i18n via targeted text insert into `src/i18n/locales/{en,si,ta}.json` — never whole-file round-trip.
- New screens start with `// @ts-nocheck` line 1; hidden screens `href: null, tabBarStyle: { display: "none" }`.
- Verification: `cd apps/mobile && npx tsc --noEmit | grep -v TS2786`, touched files only.
- Lab stage machine is strict server-side (confirm: pending→confirmed; assign; en-route; collect; in-progress; complete with `{resultPdfUrl?, resultSummary?, notes?}`; cancel takes `{reason?}`). Render only the actions valid for the current status (web: bookings/[id] L381-438).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/src/hooks/useApi.ts` (append) | Lab + operator hooks (Task 1) |
| `apps/mobile/src/app/(lab)/_layout.tsx` (create) | Tabs: Home/Bookings/Catalog/Team (Task 2) |
| `apps/mobile/src/app/(lab)/index.tsx` (create) | Stats dashboard (Task 2) |
| `apps/mobile/src/app/(lab)/bookings.tsx` (create) | Booking queue w/ status filter (Task 2) |
| `apps/mobile/src/app/(lab)/booking-detail.tsx` (create) | Detail + workflow actions (Task 2) |
| `apps/mobile/src/app/(lab)/catalog.tsx` (create) | Tests + packages lists + create/edit (Task 2) |
| `apps/mobile/src/app/(lab)/team.tsx` (create) | Phlebotomist roster + add (Task 2) |
| `apps/mobile/src/app/(operator)/_layout.tsx` (create) | Tabs: Home/Claims/Enrollments (Task 3) |
| `apps/mobile/src/app/(operator)/index.tsx` (create) | Stats dashboard (Task 3) |
| `apps/mobile/src/app/(operator)/claims.tsx` (create) | Claims queue (Task 3) |
| `apps/mobile/src/app/(operator)/claim-detail.tsx` (create) | Decide/pay/message (Task 3) |
| `apps/mobile/src/app/(operator)/enrollments.tsx` (create) | Enrollment list (Task 3) |
| `apps/mobile/src/hooks/useProtectedRoute.ts` (modify) | `laboratory`→`/(lab)`, `insurance`→`/(operator)` (Task 3) |
| `apps/mobile/src/app/(auth)/register.tsx` (modify) | Add both roles (Task 3) |

---

### Task 1: Lab + operator hooks

**Files:**
- Modify: `apps/mobile/src/hooks/useApi.ts` (append section)

**Interfaces:**
- Consumes: `api` (`{ method, body }`; PATCH via `method: "PATCH"`).
- Produces: hooks below (Task 2/3 import names verbatim).

- [ ] **Step 1: Append lab hooks**
  ```ts
  // ─── Lab partner portal ────────────────────────────────
  export type LabBookingFilter = "pending" | "confirmed" | "phlebotomist_assigned" | "sample_collection_en_route" | "sample_collected" | "in_progress" | "completed" | "cancelled" | "all";

  export function useLabStats() {
    return useQuery({
      queryKey: ["lab-portal", "stats"],
      queryFn: () => api<{ stats: any }>("/lab-portal/stats"),
      staleTime: 30_000,
    });
  }

  export function useLabBookings(status?: string) {
    return useQuery({
      queryKey: ["lab-portal", "bookings", status || ""],
      queryFn: () => api<{ bookings: any[] }>(`/lab-portal/bookings${status ? `?status=${status}` : ""}`),
      refetchInterval: 30_000,
    });
  }

  export function useLabBookingDetail(id: string | undefined) {
    return useQuery({
      queryKey: ["lab-portal", "booking", id],
      queryFn: () => api<{ booking: any }>(`/lab-portal/bookings/${id}`),
      enabled: !!id,
    });
  }

  // One hook per stage (server enforces order; 400 otherwise).
  function useLabStage(action: string, body?: (vars: any) => any) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (vars: { id: string } & Record<string, any>) =>
        api<{ booking: any }>(`/lab-portal/bookings/${vars.id}/${action}`, {
          method: "PATCH",
          body: body ? body(vars) : {},
        }),
      onSuccess: (_res, { id }) => {
        qc.invalidateQueries({ queryKey: ["lab-portal", "bookings"] });
        qc.invalidateQueries({ queryKey: ["lab-portal", "booking", id] });
        qc.invalidateQueries({ queryKey: ["lab-portal", "stats"] });
      },
    });
  }
  export function useLabConfirmBooking() { return useLabStage("confirm"); }
  export function useLabMarkEnRoute() { return useLabStage("en-route"); }
  export function useLabCollectSample() { return useLabStage("collect-sample"); }
  export function useLabMarkInProgress() { return useLabStage("in-progress"); }
  export function useLabAssignPhlebotomist() {
    return useLabStage("assign-phlebotomist", (v) => ({
      phlebotomistId: v.phlebotomistId,
      phlebotomistName: v.phlebotomistName,
      phlebotomistPhone: v.phlebotomistPhone,
    }));
  }
  export function useLabCompleteBooking() {
    return useLabStage("complete", (v) => ({
      resultPdfUrl: v.resultPdfUrl, resultSummary: v.resultSummary, notes: v.notes,
    }));
  }
  export function useLabCancelBooking() {
    return useLabStage("cancel", (v) => ({ reason: v.reason }));
  }

  export function useLabCatalog() {
    return useQuery({
      queryKey: ["lab-portal", "catalog"],
      queryFn: () => api<{ tests: any[] }>("/lab-portal/catalog"),
    });
  }
  export function useLabPackages() {
    return useQuery({
      queryKey: ["lab-portal", "packages"],
      queryFn: () => api<{ packages: any[] }>("/lab-portal/packages"),
    });
  }
  export function useLabSaveTest() {
    const qc = useQueryClient();
    return useMutation({
      // { id? } → PUT /catalog/:id else POST /catalog.
      // Fields: name, category, description?, sampleType, fastingRequired,
      // fastingHours, homeCollectionAvailable, price, discountPrice?,
      // turnaroundHours, instructions?, isActive.
      mutationFn: (input: any) =>
        api<{ test: any }>(input.id ? `/lab-portal/catalog/${input.id}` : "/lab-portal/catalog", {
          method: input.id ? "PUT" : "POST",
          body: input,
        }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-portal", "catalog"] }); },
    });
  }
  export function useLabSavePackage() {
    const qc = useQueryClient();
    return useMutation({
      // Fields: name, description?, price, discountPrice?, turnaroundHours,
      // instructions?, isActive. Same id? → PUT : POST pattern.
      mutationFn: (input: any) =>
        api<{ package: any }>(input.id ? `/lab-portal/packages/${input.id}` : "/lab-portal/packages", {
          method: input.id ? "PUT" : "POST",
          body: input,
        }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-portal", "packages"] }); },
    });
  }
  export function useLabPhlebotomists() {
    return useQuery({
      queryKey: ["lab-portal", "phlebotomists"],
      queryFn: () => api<{ phlebotomists: any[] }>("/lab-portal/phlebotomists"),
    });
  }
  export function useLabAddPhlebotomist() {
    const qc = useQueryClient();
    return useMutation({
      // Fields: name, phone, email?.
      mutationFn: (input: { name: string; phone: string; email?: string }) =>
        api<{ phlebotomist: any }>("/lab-portal/phlebotomists", { method: "POST", body: input }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-portal", "phlebotomists"] }); },
    });
  }
  ```
  Note: verify response envelopes (`{ bookings }`, `{ tests }`, `{ packages }`, `{ phlebotomists }`, `{ stats }`) against backend before finalizing — list routes above return these shapes per web hooks; if a key differs (e.g. `{ items }`), adjust the hook, not the screens.

- [ ] **Step 2: Append operator hooks**
  ```ts
  // ─── Insurance operator portal ────────────────────────────────
  export function useOperatorDashboard() {
    return useQuery({
      queryKey: ["insurance-operator", "dashboard"],
      queryFn: () => api<{ stats: any }>("/insurance-operator/dashboard"),
      staleTime: 30_000,
    });
  }
  export function useOperatorClaims(status?: string) {
    return useQuery({
      queryKey: ["insurance-operator", "claims", status || ""],
      queryFn: () => api<{ claims: any[] }>(`/insurance-operator/claims${status ? `?status=${status}` : ""}`),
    });
  }
  export function useOperatorClaim(id: string | undefined) {
    return useQuery({
      queryKey: ["insurance-operator", "claim", id],
      queryFn: () => api<{ claim: any }>(`/insurance-operator/claims/${id}`),
      enabled: !!id,
    });
  }
  export function useOperatorEnrollments() {
    return useQuery({
      queryKey: ["insurance-operator", "enrollments"],
      queryFn: () => api<{ enrollments: any[] }>("/insurance-operator/enrollments"),
    });
  }
  export function useDecideOperatorClaim() {
    const qc = useQueryClient();
    return useMutation({
      // decision: approve (amountApprovedLkr? defaults to requested) |
      // reject | more_info. Server allows only submitted/under_review/more_info_needed.
      mutationFn: (input: { id: string; decision: "approve" | "reject" | "more_info"; amountApprovedLkr?: number; remarks?: string }) =>
        api<{ claim: any }>(`/insurance-operator/claims/${input.id}/decision`, {
          method: "POST",
          body: { decision: input.decision, amountApprovedLkr: input.amountApprovedLkr, remarks: input.remarks },
        }),
      onSuccess: (_res, { id }) => {
        qc.invalidateQueries({ queryKey: ["insurance-operator", "claims"] });
        qc.invalidateQueries({ queryKey: ["insurance-operator", "claim", id] });
        qc.invalidateQueries({ queryKey: ["insurance-operator", "dashboard"] });
      },
    });
  }
  export function usePayOperatorClaim() {
    const qc = useQueryClient();
    return useMutation({
      // Only approved claims. transactionRef REQUIRED by server.
      mutationFn: (input: { id: string; amountApprovedLkr?: number; transactionRef: string }) =>
        api<{ claim: any }>(`/insurance-operator/claims/${input.id}/pay`, {
          method: "POST",
          body: { amountApprovedLkr: input.amountApprovedLkr, transactionRef: input.transactionRef },
        }),
      onSuccess: (_res, { id }) => {
        qc.invalidateQueries({ queryKey: ["insurance-operator", "claims"] });
        qc.invalidateQueries({ queryKey: ["insurance-operator", "claim", id] });
        qc.invalidateQueries({ queryKey: ["insurance-operator", "dashboard"] });
      },
    });
  }
  ```

- [ ] **Step 3: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep "hooks/useApi" | grep -v "(4833" || echo CLEAN`
  Expected: `CLEAN` (4833 is the known pre-existing insurance-claim error).

- [ ] **Step 4: Commit**
  ```bash
  git add apps/mobile/src/hooks/useApi.ts
  git commit -m "feat(mobile): lab-portal and insurance-operator API hooks"
  ```

---

### Task 2: (lab) group screens

**Files:** create `(lab)/_layout.tsx`, `(lab)/index.tsx`, `(lab)/bookings.tsx`, `(lab)/booking-detail.tsx`, `(lab)/catalog.tsx`, `(lab)/team.tsx`; i18n `lab.*` + `nav.tabs.lab{Home,Bookings,Catalog,Team}`.

- [ ] **Step 1: _layout + i18n**
  Copy `(pharmacist)/_layout.tsx`; tabs: index (LayoutDashboard, `nav.tabs.labHome`), bookings (ClipboardList, `nav.tabs.labBookings`), catalog (FlaskConical or TestTube — verify export exists in lucide-react-native first, else Beaker, `nav.tabs.labCatalog`), team (Users, `nav.tabs.labTeam`); hidden `booking-detail`. Keys (en; si/ta English fallback):
  ```json
  "nav": { "tabs": { "labHome": "Home", "labBookings": "Bookings", "labCatalog": "Catalog", "labTeam": "Team" } },
  "lab": {
    "homeTitle": "Lab dashboard", "bookingsTitle": "Test bookings",
    "statuses": { "pending": "Pending", "confirmed": "Confirmed", "phlebotomist_assigned": "Assigned", "sample_collection_en_route": "En route", "sample_collected": "Collected", "in_progress": "In progress", "completed": "Completed", "cancelled": "Cancelled", "all": "All" },
    "confirm": "Confirm booking", "assign": "Assign phlebotomist", "enRoute": "Mark en route",
    "collect": "Mark sample collected", "startProcessing": "Start processing",
    "complete": "Upload results & complete", "cancelBooking": "Cancel booking",
    "resultSummary": "Result summary", "resultSummaryPlaceholder": "e.g. All parameters within normal range",
    "cancelReason": "Cancellation reason", "selectPhlebotomist": "Select phlebotomist",
    "catalogTitle": "Test catalog", "packagesTitle": "Packages", "teamTitle": "Phlebotomists",
    "price": "LKR {{amount}}", "addTest": "Add test", "editTest": "Edit test", "addPackage": "Add package",
    "addMember": "Add phlebotomist", "name": "Name", "phone": "Phone", "category": "Category",
    "empty": "Nothing here yet"
  }
  ```

- [ ] **Step 2: Dashboard + bookings list**
  `index.tsx`: `useLabStats()` → stat cards (total/today/pending; guard with `?.` — exact stat keys verified in Step 1). `bookings.tsx`: status filter chips (pending default + all + rest) → `useLabBookings`; rows (patient, item name, scheduledDate, status chip) → push `booking-detail?id=`. Skeleton/error/empty per Slice 1 patterns.

- [ ] **Step 3: Booking detail (status-gated actions)**
  Render actions ONLY for the current status (copy web conditions): pending → Confirm; confirmed|pending → Assign (BottomSheet with roster from `useLabPhlebotomists()` + manual name/phone fallback); phlebotomist_assigned → En route; assigned|en-route → Collect; collected|in_progress → Complete (BottomSheet: resultSummary + notes; resultPdfUrl omitted — mobile upload out of scope, pass-through only); all non-final → Cancel (reason sheet). After each mutation: toast + stay (detail refetches via invalidation).

- [ ] **Step 4: Catalog + team**
  `catalog.tsx`: two sections (tests, packages); each row name + price + active state; Add/Edit opens BottomSheet form (name, category [tests only], price, description) → save hooks; no delete (server supports it; omitted YAGNI — note in file header). `team.tsx`: roster list (name/phone/active) + Add sheet (name/phone/email) → `useLabAddPhlebotomist`.

- [ ] **Step 5: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -E "\(lab\)|useApi" | grep -v "(4833" || echo CLEAN`
  Expected: `CLEAN`.
  Smoke (lab login, dev): dashboard → bookings → confirm → assign → en-route → collect → complete; catalog add/edit; roster add.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/mobile/src/app/\(lab\)/ apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): lab partner portal (bookings workflow, catalog, roster)"
  ```

---

### Task 3: (operator) group + routing

**Files:** create `(operator)/_layout.tsx`, `(operator)/index.tsx`, `(operator)/claims.tsx`, `(operator)/claim-detail.tsx`, `(operator)/enrollments.tsx`; modify `useProtectedRoute.ts`, `register.tsx`; i18n `operator.*` + `nav.tabs.operator*`.

- [ ] **Step 1: _layout + screens + i18n**
  Copy `(pharmacist)/_layout.tsx`; tabs: index (LayoutDashboard, `nav.tabs.operatorHome`), claims (FileText, `nav.tabs.operatorClaims`), enrollments (Users, `nav.tabs.operatorEnrollments`); hidden `claim-detail`. Keys:
  ```json
  "nav": { "tabs": { "operatorHome": "Home", "operatorClaims": "Claims", "operatorEnrollments": "Enrollments" } },
  "operator": {
    "homeTitle": "Operator dashboard", "claimsTitle": "Claims", "enrollmentsTitle": "Enrollments",
    "statuses": { "submitted": "Submitted", "under_review": "Under review", "more_info_needed": "More info", "approved": "Approved", "rejected": "Rejected", "paid": "Paid", "all": "All" },
    "approve": "Approve", "reject": "Reject", "requestInfo": "Request info", "pay": "Record payment",
    "approvedAmount": "Approved amount (LKR)", "remarks": "Remarks (optional)",
    "transactionRef": "Transaction reference", "noOrg": "This account is not linked to an insurance organization yet. Contact your administrator.",
    "amountRequested": "Requested", "amountApproved": "Approved", "empty": "No claims in this state"
  }
  ```
  `index.tsx`: `useOperatorDashboard()` stats; on 403 → `operator.noOrg` EmptyState (unbound `insurance` role). `claims.tsx`: status chips → list → push detail. `claim-detail.tsx`: amounts, documents count, messages thread (read-only; post-message omitted YAGNI — note in header), decision buttons for actionable statuses (submitted/under_review/more_info_needed): Approve (+amount input, defaults to requested), Reject, More-info (+remarks input); approved → Pay sheet (amount + REQUIRED transactionRef). `enrollments.tsx`: read-only rows (user, plan, policy, status, premium).

- [ ] **Step 2: Routing + register**
  `homeForRole`/`groupForRole`: `laboratory` → `/(lab)`/`(lab)`; `insurance` → `/(operator)`/`(operator)`; add both to the bounce list. `register.tsx`: extend zod enum + `useState` type with `"laboratory"`, `"insurance"`; picker entries (icons: FlaskConical/TestTube-verified and ShieldCheck — both already used elsewhere; verify import or add); post-register route nest both homes. No extra required fields (server: NIC/DOB optional for non-patients; labProfile/license fields optional).

- [ ] **Step 3: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -E "\(operator\)|useProtectedRoute|\(auth\)/register" || echo CLEAN`
  Expected: `CLEAN`.
  Smoke: lab register → `/(lab)`; insurance login (org-bound test account) → dashboard/claims/decide/pay; unbound insurance account → noOrg state.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/mobile/src/app/\(operator\)/ apps/mobile/src/hooks/useProtectedRoute.ts apps/mobile/src/app/\(auth\)/register.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): insurance-operator portal, lab/operator role routing"
  ```

---

## Self-Review

- **Spec coverage:** Slice 3 items all tasked — lab dashboard/bookings/stages/catalog/packages/roster (Tasks 1–2), operator dashboard/claims/enrollments/decide/pay (Tasks 1, 3), routing/register (§1 → Task 3 Step 2).
- **Placeholder scan:** No TBDs. Deliberate scope cuts documented inline: catalog/package delete omitted, result PDF upload omitted (pass-through URL only), claim messages read-only. Envelope keys flagged verify-first (Task 1 Step 1 note).
- **Type consistency:** Hook names prefixed `useLab*` / `useOperator*|useDecideOperatorClaim|usePayOperatorClaim`; query keys `["lab-portal", ...]` / `["insurance-operator", ...]`; routes `/(lab)/...`, `/(operator)/...`; roles `laboratory`/`insurance` match backend `requireRole` + register enum.
