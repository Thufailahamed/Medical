# Records Write-Path Single-Record UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/patient/records/[id]` from read-only to full write-path parity with mobile's `record-detail`, plus add `/patient/records/new` (create via envelope) and `/patient/records/[id]/edit`.

**Architecture:** Add shared contract path/key/type builders; extend `apps/marketing/src/patient/hooks/records.ts` with 13 new hooks (5 child reads + 6 record mutations + attachment + re-extract); add 9 components under `apps/marketing/src/patient/components/records/`; expand the detail page; add create + edit pages; mirror mutations on web that the mobile `useApi.ts` already exposes.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TanStack React Query, `@healthcare/shared` (contracts + records registry), Vitest + Testing Library.

## Global Constraints

- Branch: `feat/mobile-web-parity`
- No new npm dependencies. Use existing `@/patient/hooks`, `@healthcare/shared/contracts`, `@healthcare/shared/records`, `@/portal/lib/api`
- File picker: HTML `<input type="file">` + `FormData`. Client cap 50 MB. Client MIME allowlist: `application/pdf,image/jpeg,image/png,image/webp`
- Kind registry: 22 kinds from `@healthcare/shared/records` (`RECORD_KINDS`)
- Tag normalisation: lowercase, trim, dedupe, drop empty, ≤40 chars
- Confirm: native `window.confirm()` (existing pattern in `caretakers`, `family`, `appointments/[id]`)
- Toast: `@/portal/components/ui/Toast` — `toast.success/error/info(title, body?)`
- Test command: `cd apps/marketing && bun run test`. Failure count must be ≤ 8 baseline
- Typecheck: `bunx tsc --noEmit -p apps/marketing/tsconfig.json`. New errors must be 0; pre-existing 32 unrelated
- Parity manifest: any new parity page must be added with status `done` and resolve to a real page file (enforced by `apps/marketing/src/patient/parity.test.ts`)
- `patientKeys.recordChildren(id, kind)` already exists; this is its first consumer
- Mobile side: out of scope. Mobile uses ad-hoc keys in `useApi.ts`; the parity contract is feature parity, not code parity
- Tests mock `@/patient/hooks` with `vi.mock("@/patient/hooks", ...)`; never mock individual hook files

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/shared/src/contracts/paths.ts` | Path builders (additive: `records.create`, `records.attachments`, `records.children.*`, etc.) |
| `packages/shared/src/contracts/keys.ts` | Query-key factory (additive: `recordAttachments`) |
| `packages/shared/src/contracts/types.ts` | Shared types (additive: `RecordCreateInput`, `RecordUpdateInput`, `RecordAttachment`) |
| `apps/marketing/src/patient/hooks/records.ts` | Extend with 13 new hooks (reads + mutations + re-extract) |
| `apps/marketing/src/patient/components/records/RecordForm.tsx` | Shared form for new + edit |
| `apps/marketing/src/patient/components/records/RecordActionsBar.tsx` | Action buttons on detail |
| `apps/marketing/src/patient/components/records/RecordAttachmentsSection.tsx` | Attachments list + upload + presign + delete |
| `apps/marketing/src/patient/components/records/StructuredChildren.tsx` | Kind-switch container |
| `apps/marketing/src/patient/components/records/LabResultsTable.tsx` | Lab results table |
| `apps/marketing/src/patient/components/records/ImagingFindingsCard.tsx` | Imaging findings card |
| `apps/marketing/src/patient/components/records/DischargeEventsList.tsx` | Discharge events list |
| `apps/marketing/src/patient/components/records/VaccinationDosesList.tsx` | Vaccination doses list |
| `apps/marketing/src/patient/components/records/PrescriptionItemsList.tsx` | Prescription items list |
| `apps/marketing/src/app/patient/(app)/records/new/page.tsx` | Create page |
| `apps/marketing/src/app/patient/(app)/records/[id]/edit/page.tsx` | Edit page |
| `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx` | Expanded detail page |
| `docs/parity-manifest.md` | Flip 2 rows to `done`, update 1 row note |

---

### Task 1: Add record write-path builders to `patientPaths.records`

**Files:**
- Modify: `packages/shared/src/contracts/paths.ts:65-72`
- Test: `packages/shared/src/contracts/__tests__/records-paths.test.ts` (create)

**Interfaces:**
- Consumes: existing `qs()` helper in same file
- Produces: new builders exported via `patientPaths.records.*`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/contracts/__tests__/records-paths.test.ts
import { describe, it, expect } from "vitest";
import { patientPaths } from "../paths";

describe("patientPaths.records (write-path additions)", () => {
  it("create() points at the envelope endpoint", () => {
    expect(patientPaths.records.create()).toBe("/medical-records/envelope");
  });

  it("update(id) and delete(id) hit /medical-records/:id", () => {
    expect(patientPaths.records.update("abc")).toBe("/medical-records/abc");
    expect(patientPaths.records.delete("abc")).toBe("/medical-records/abc");
  });

  it("attachments(id) and reExtract(id) hit /files and /medical-records child routes", () => {
    expect(patientPaths.records.attachments("r1")).toBe("/files/record/r1");
    expect(patientPaths.records.attachmentUpload()).toBe("/files/upload");
    expect(patientPaths.records.attachmentDelete("f1")).toBe("/files/f1");
    expect(patientPaths.records.attachmentPresign()).toBe("/files/presign");
    expect(patientPaths.records.reExtract("r1")).toBe("/medical-records/r1/re-extract");
  });

  it("attachmentDownload(key, stream) builds stream query when set", () => {
    expect(patientPaths.records.attachmentDownload("k", 1)).toBe("/files/download/k?stream=1");
    expect(patientPaths.records.attachmentDownload("k")).toBe("/files/download/k?stream=");
  });

  it("children.* hit the per-kind child endpoints", () => {
    expect(patientPaths.records.children.lab("r1")).toBe("/medical-records/r1/lab-results");
    expect(patientPaths.records.children.imaging("r1")).toBe("/medical-records/r1/imaging-findings");
    expect(patientPaths.records.children.discharge("r1")).toBe("/medical-records/r1/discharge-events");
    expect(patientPaths.records.children.vaccination("r1")).toBe("/medical-records/r1/vaccination-doses");
    expect(patientPaths.records.children.prescription("r1")).toBe("/medical-records/r1/prescription-items");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bunx vitest run src/contracts/__tests__/records-paths.test.ts`
Expected: FAIL (builders missing). If packages/shared has no vitest config, fall back to `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-paths.test.ts` after copying the test there.

- [ ] **Step 3: Add the builders**

Replace `packages/shared/src/contracts/paths.ts:65-72` with:

```ts
  records: {
    mine: (q: RecordsQuery = {}) =>
      `/medical-records/me${qs({ type: q.type, search: q.search, limit: q.limit })}`,
    stats: () => "/medical-records/me/stats",
    detail: (id: string) => `/medical-records/${id}`,
    labResults: (q: LabResultsQuery = {}) =>
      `/medical-records/me/lab-results${qs({ months: q.months, test: q.test })}`,
    // Write-path additions (SP2a)
    create: () => "/medical-records/envelope",
    update: (id: string) => `/medical-records/${id}`,
    delete: (id: string) => `/medical-records/${id}`,
    attachments: (id: string) => `/files/record/${id}`,
    attachmentUpload: () => "/files/upload",
    attachmentDelete: (id: string) => `/files/${id}`,
    attachmentPresign: () => "/files/presign",
    attachmentDownload: (key: string, stream?: 0 | 1) =>
      `/files/download/${key}${qs({ stream })}`,
    reExtract: (id: string) => `/medical-records/${id}/re-extract`,
    children: {
      lab: (id: string) => `/medical-records/${id}/lab-results`,
      imaging: (id: string) => `/medical-records/${id}/imaging-findings`,
      discharge: (id: string) => `/medical-records/${id}/discharge-events`,
      vaccination: (id: string) => `/medical-records/${id}/vaccination-doses`,
      prescription: (id: string) => `/medical-records/${id}/prescription-items`,
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run <path-from-step-2>`
Expected: PASS (7 assertions)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/paths.ts packages/shared/src/contracts/__tests__/records-paths.test.ts
git commit -m "feat(contracts): record write-path path builders"
```

---

### Task 2: Add `recordAttachments` query key

**Files:**
- Modify: `packages/shared/src/contracts/keys.ts:37-46`
- Test: `packages/shared/src/contracts/__tests__/records-keys.test.ts` (create)

**Interfaces:**
- Consumes: existing `patientKeys.record(id)`, `recordChildren(id, kind)`
- Produces: `patientKeys.recordAttachments(id)`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/contracts/__tests__/records-keys.test.ts
import { describe, it, expect } from "vitest";
import { patientKeys } from "../keys";

describe("patientKeys (write-path additions)", () => {
  it("recordAttachments(id) is stable and prefix-namespaced", () => {
    expect(patientKeys.recordAttachments("r1")).toEqual(["patient", "records", "r1", "attachments"]);
  });

  it("recordChildren(id, kind) is unchanged from prior contract", () => {
    expect(patientKeys.recordChildren("r1", "lab_report")).toEqual([
      "patient",
      "records",
      "r1",
      "lab_report",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run <path>` — expected FAIL on `recordAttachments`.

- [ ] **Step 3: Add the key factory**

After `patientKeys.record(id)` in `keys.ts:40`, add:

```ts
  recordAttachments: (id: string) =>
    ["patient", "records", id, "attachments"] as const,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run <path>` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/keys.ts packages/shared/src/contracts/__tests__/records-keys.test.ts
git commit -m "feat(contracts): recordAttachments query key"
```

---

### Task 3: Add write-path types

**Files:**
- Modify: `packages/shared/src/contracts/types.ts:226-243`
- No test (types are erased at runtime; the path/key tests cover the contract surface)

**Interfaces:**
- Consumes: `RecordKind` from `@healthcare/shared/records`
- Produces: `RecordCreateInput`, `RecordUpdateInput`, `RecordAttachment`

- [ ] **Step 1: Add the types**

Replace the `RecordRow` + `RecordStats` block in `types.ts:226-243` with:

```ts
/** A row from GET /medical-records/me. */
export interface RecordRow {
  id: string;
  recordType: string;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  date: string;
  status: "pending" | "completed" | "cancelled" | null;
  tags: string | null;
  createdAt: string;
}

/** GET /medical-records/me/stats */
export interface RecordStats {
  total: number;
  byType: Record<string, number>;
}

/** POST /medical-records/envelope — patient-allowed create path. */
export interface RecordCreateInput {
  kind: string;
  title: string;
  summary?: string;
  notes?: string;
  diagnosis?: string;
  tags?: string[];
  familyMemberId?: string | null;
  recordDate?: string;
}

/** PATCH /medical-records/:id. */
export interface RecordUpdateInput {
  id: string;
  title?: string;
  diagnosis?: string;
  summary?: string;
  notes?: string;
  date?: string;
  followUpDate?: string;
  recordType?: string;
  tags?: string[];
  familyMemberId?: string | null;
  archived?: boolean;
}

/** One row from GET /files/record/:recordId. */
export interface RecordAttachment {
  id: string;
  recordId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  r2Key?: string;
  uploadedByUserId?: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `bunx tsc --noEmit -p apps/marketing/tsconfig.json 2>&1 | tail -10`
Expected: same 32 pre-existing errors, 0 new errors. The typecheck may surface "unused" warnings for the new types — that's fine, downstream tasks consume them.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/contracts/types.ts
git commit -m "feat(contracts): record write-path input types"
```

---

### Task 4: Add web hooks — record reads (attachments + 5 child kinds)

**Files:**
- Modify: `apps/marketing/src/patient/hooks/records.ts` (append)
- Test: `apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts` (create)

**Interfaces:**
- Consumes: `api`, `patientKeys`, `patientPaths` from existing imports
- Produces: `useRecordAttachments`, `useRecordLabResults`, `useRecordImagingFindings`, `useRecordDischargeEvents`, `useRecordVaccinationDoses`, `useRecordPrescriptionItems`

- [ ] **Step 1: Write the failing test**

```ts
// apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts
import { describe, it, expect, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("@/portal/lib/api", () => ({ api: apiMock }));

import {
  useRecordAttachments,
  useRecordLabResults,
  useRecordImagingFindings,
  useRecordDischargeEvents,
  useRecordVaccinationDoses,
  useRecordPrescriptionItems,
} from "../records";

describe("record read hooks (write-path additions)", () => {
  it("useRecordAttachments queries the right key and path", () => {
    const { result } = renderHook(() => useRecordAttachments("r1"), { wrapper });
    expect(result.current.queryKey).toEqual(["patient", "records", "r1", "attachments"]);
    expect(apiMock).toHaveBeenCalledWith("/files/record/r1");
  });

  it("useRecordLabResults hits the lab-results child endpoint", () => {
    const { result } = renderHook(() => useRecordLabResults("r1"), { wrapper });
    expect(apiMock).toHaveBeenCalledWith("/medical-records/r1/lab-results");
  });

  it("useRecordImagingFindings hits the imaging-findings child endpoint", () => {
    const { result } = renderHook(() => useRecordImagingFindings("r1"), { wrapper });
    expect(apiMock).toHaveBeenCalledWith("/medical-records/r1/imaging-findings");
  });

  it("useRecordDischargeEvents hits the discharge-events child endpoint", () => {
    const { result } = renderHook(() => useRecordDischargeEvents("r1"), { wrapper });
    expect(apiMock).toHaveBeenCalledWith("/medical-records/r1/discharge-events");
  });

  it("useRecordVaccinationDoses hits the vaccination-doses child endpoint", () => {
    const { result } = renderHook(() => useRecordVaccinationDoses("r1"), { wrapper });
    expect(apiMock).toHaveBeenCalledWith("/medical-records/r1/vaccination-doses");
  });

  it("useRecordPrescriptionItems hits the prescription-items child endpoint", () => {
    const { result } = renderHook(() => useRecordPrescriptionItems("r1"), { wrapper });
    expect(apiMock).toHaveBeenCalledWith("/medical-records/r1/prescription-items");
  });
});
```

Top of the test file needs a wrapper + renderHook import — add:

```ts
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: FAIL (hooks missing).

- [ ] **Step 3: Add the hooks**

Append to `apps/marketing/src/patient/hooks/records.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type {
  RecordCreateInput,
  RecordUpdateInput,
  RecordAttachment,
} from "@healthcare/shared/contracts";

export function useRecordAttachments(id: string) {
  return useQuery<{ files: RecordAttachment[] }>({
    queryKey: patientKeys.recordAttachments(id),
    queryFn: () =>
      api<{ files: RecordAttachment[] }>(patientPaths.records.attachments(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordLabResults(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "lab_report"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.lab(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordImagingFindings(id: string) {
  return useQuery<{ item: unknown }>({
    queryKey: patientKeys.recordChildren(id, "imaging"),
    queryFn: () =>
      api<{ item: unknown }>(patientPaths.records.children.imaging(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordDischargeEvents(id: string) {
  return useQuery<{ item: unknown }>({
    queryKey: patientKeys.recordChildren(id, "discharge_summary"),
    queryFn: () =>
      api<{ item: unknown }>(patientPaths.records.children.discharge(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordVaccinationDoses(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "vaccination"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.vaccination(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordPrescriptionItems(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "prescription"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.prescription(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}
```

(Consolidate the import block at the top — current file imports only `useQuery`. Adjust as needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/hooks/records.ts apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts
git commit -m "feat(patient): record read hooks for attachments + child kinds"
```

---

### Task 5: Add web hooks — record mutations (create / update / delete / archive / restore / move)

**Files:**
- Modify: `apps/marketing/src/patient/hooks/records.ts` (append)
- Test: extend `apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts`

**Interfaces:**
- Consumes: existing `useQueryClient`, `api`, `patientKeys`, `patientPaths`
- Produces: `useCreateRecord`, `useUpdateRecord`, `useDeleteRecord`, `useArchiveRecord`, `useRestoreRecord`, `useMoveRecord`

- [ ] **Step 1: Write the failing test**

Append to `apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts`:

```ts
import {
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useArchiveRecord,
  useRestoreRecord,
  useMoveRecord,
} from "../records";

describe("record mutation hooks", () => {
  it("useCreateRecord posts to /medical-records/envelope", async () => {
    apiMock.mockResolvedValueOnce({ id: "r1", envelopeVersion: "v1" });
    const { result } = renderHook(() => useCreateRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        kind: "lab_report",
        title: "x",
      });
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/medical-records/envelope",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("useUpdateRecord patches /medical-records/:id", async () => {
    apiMock.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useUpdateRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "r1", title: "y" });
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/medical-records/r1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("useDeleteRecord deletes /medical-records/:id", async () => {
    apiMock.mockResolvedValueOnce({ message: "deleted" });
    const { result } = renderHook(() => useDeleteRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/medical-records/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("useArchiveRecord patches with {archived:true}", async () => {
    apiMock.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useArchiveRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/medical-records/r1",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(apiMock.mock.calls.at(-1)[1].body);
    expect(body).toEqual({ archived: true });
  });

  it("useRestoreRecord patches with {archived:false}", async () => {
    apiMock.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useRestoreRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    const body = JSON.parse(apiMock.mock.calls.at(-1)[1].body);
    expect(body).toEqual({ archived: false });
  });

  it("useMoveRecord patches with familyMemberId", async () => {
    apiMock.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useMoveRecord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "r1", familyMemberId: "fm-2" });
    });
    const body = JSON.parse(apiMock.mock.calls.at(-1)[1].body);
    expect(body).toEqual({ familyMemberId: "fm-2" });
  });
});
```

Add `import { act } from "@testing-library/react";` to the imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: FAIL on mutation tests.

- [ ] **Step 3: Add the mutations**

Append to `apps/marketing/src/patient/hooks/records.ts`:

```ts
export function useCreateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordCreateInput) =>
      api<{ id: string; envelopeVersion: string }>(
        patientPaths.records.create(),
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
    },
  });
}

export function useUpdateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordUpdateInput) => {
      const { id, ...rest } = input;
      return api<{ record: RecordRow }>(
        patientPaths.records.update(id),
        { method: "PATCH", body: JSON.stringify(rest) },
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.id) });
    },
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.records.delete(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
    },
  });
}

export function useArchiveRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: RecordRow }>(patientPaths.records.update(id), {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(id) });
    },
  });
}

export function useRestoreRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: RecordRow }>(patientPaths.records.update(id), {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(id) });
    },
  });
}

export function useMoveRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; familyMemberId: string | null }) =>
      api<{ record: RecordRow }>(patientPaths.records.update(vars.id), {
        method: "PATCH",
        body: JSON.stringify({ familyMemberId: vars.familyMemberId }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.id) });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: PASS (12 assertions total).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/hooks/records.ts apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts
git commit -m "feat(patient): record write-path mutations (create/update/delete/archive/restore/move)"
```

---

### Task 6: Add web hooks — attachment mutations + re-extract

**Files:**
- Modify: `apps/marketing/src/patient/hooks/records.ts` (append)
- Test: extend `apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts`

**Interfaces:**
- Consumes: existing `api`, `patientKeys`, `patientPaths`, `useQueryClient`
- Produces: `useAddAttachment`, `useDeleteAttachment`, `usePresignAttachment`, `useReExtractRecord`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import {
  useAddAttachment,
  useDeleteAttachment,
  usePresignAttachment,
  useReExtractRecord,
} from "../records";

describe("attachment + re-extract hooks", () => {
  it("useAddAttachment posts multipart FormData with recordId", async () => {
    apiMock.mockResolvedValueOnce({ file: { id: "f1" } });
    const { result } = renderHook(() => useAddAttachment("r1"), { wrapper });
    const file = new File(["x"], "lab.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.mutateAsync({ file });
    });
    const [path, init] = apiMock.mock.calls.at(-1);
    expect(path).toBe("/files/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("recordId")).toBe("r1");
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("useDeleteAttachment deletes /files/:id", async () => {
    apiMock.mockResolvedValueOnce({ message: "deleted" });
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "f1", recordId: "r1" });
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/files/f1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("usePresignAttachment posts to /files/presign", async () => {
    apiMock.mockResolvedValueOnce({ token: "t", expiresAt: "x", url: "u" });
    const { result } = renderHook(() => usePresignAttachment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ fileId: "f1" });
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/files/presign",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(apiMock.mock.calls.at(-1)[1].body);
    expect(body).toEqual({ fileId: "f1" });
  });

  it("useReExtractRecord posts to /medical-records/:id/re-extract", async () => {
    apiMock.mockResolvedValueOnce({ result: "ok" });
    const { result } = renderHook(() => useReExtractRecord("r1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/medical-records/r1/re-extract",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the hooks**

Append to `apps/marketing/src/patient/hooks/records.ts`:

```ts
export function useAddAttachment(recordId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      fd.append("recordId", recordId);
      return api<{ file: RecordAttachment }>(
        patientPaths.records.attachmentUpload(),
        { method: "POST", body: fd },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.recordAttachments(recordId) });
      qc.invalidateQueries({ queryKey: patientKeys.record(recordId) });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; recordId: string }) =>
      api<{ message: string }>(patientPaths.records.attachmentDelete(vars.id), {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: patientKeys.recordAttachments(vars.recordId) });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.recordId) });
    },
  });
}

export function usePresignAttachment() {
  return useMutation({
    mutationFn: (vars: { fileId: string }) =>
      api<{ token: string; expiresAt: string; url: string }>(
        patientPaths.records.attachmentPresign(),
        { method: "POST", body: JSON.stringify(vars) },
      ),
  });
}

export function useReExtractRecord(recordId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ result: unknown }>(patientPaths.records.reExtract(recordId), {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.record(recordId) });
      qc.invalidateQueries({ queryKey: ["patient", "records", recordId] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/hooks/__tests__/records-hooks.test.ts`
Expected: PASS (16 assertions total).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/hooks/records.ts apps/marketing/src/patient/hooks/__tests__/records-hooks.test.ts
git commit -m "feat(patient): attachment upload/delete/presign + re-extract hooks"
```

---

### Task 7: Build `RecordForm` component (shared by new + edit)

**Files:**
- Create: `apps/marketing/src/patient/components/records/RecordForm.tsx`
- Create: `apps/marketing/src/patient/components/records/RecordForm.test.tsx`

**Interfaces:**
- Consumes: `useCreateRecord`, `useUpdateRecord`, `RECORD_KINDS` from `@healthcare/shared/records`
- Produces: form with kind chips, title, date, diagnosis, summary, notes, tags, familyMemberId

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/patient/components/records/RecordForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mutateAsync = vi.fn();
vi.mock("@/patient/hooks", () => ({
  useCreateRecord: () => ({ mutateAsync, isPending: false }),
  useUpdateRecord: () => ({ mutateAsync, isPending: false }),
}));

import { RecordForm } from "./RecordForm";

describe("RecordForm", () => {
  it("renders all 22 kind chips and a title input", () => {
    render(<RecordForm mode="create" onSuccess={() => {}} />);
    expect(screen.getByPlaceholderText(/CBC 2026-08-15/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /lab_report|imaging|prescription/ }).length).toBeGreaterThan(0);
  });

  it("calls useCreateRecord with normalised tags on submit", async () => {
    mutateAsync.mockResolvedValueOnce({ id: "r1" });
    const onSuccess = vi.fn();
    render(<RecordForm mode="create" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText(/CBC/i), { target: { value: "Lipid panel" } });
    fireEvent.change(screen.getByPlaceholderText(/annual, fasting/i), {
      target: { value: "Annual, Annual, fasting " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "lab_report", // default first kind
          title: "Lipid panel",
          tags: ["annual", "fasting"],
        }),
      );
    });
    expect(onSuccess).toHaveBeenCalledWith("r1");
  });

  it("pre-fills fields and is read-only on kind when mode=edit", () => {
    render(
      <RecordForm
        mode="edit"
        recordId="r1"
        initial={{ kind: "imaging", title: "MRI knee", date: "2026-08-01", diagnosis: "Torn meniscus", tags: ["left"] }}
        onSuccess={() => {}}
      />,
    );
    expect((screen.getByPlaceholderText(/CBC/i) as HTMLInputElement).value).toBe("MRI knee");
    expect(screen.getByText(/imaging/i)).toBeTruthy();
    // kind chips should not be clickable when mode=edit
    expect(screen.queryByRole("button", { name: /^switch kind/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordForm.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Implement the component**

```tsx
// apps/marketing/src/patient/components/records/RecordForm.tsx
"use client";

import { useState } from "react";
import { RECORD_KINDS, RECORD_REGISTRY } from "@healthcare/shared/records";
import { useCreateRecord, useUpdateRecord } from "@/patient/hooks";
import { Pill } from "@/patient/components/primitives/Pill";

const MAX_TAG_LEN = 40;

function normaliseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export interface RecordFormInitial {
  kind?: string;
  title?: string;
  date?: string;
  diagnosis?: string;
  summary?: string;
  notes?: string;
  tags?: string[];
  familyMemberId?: string | null;
}

export function RecordForm({
  mode,
  recordId,
  initial,
  onSuccess,
}: {
  mode: "create" | "edit";
  recordId?: string;
  initial?: RecordFormInitial;
  onSuccess: (id: string) => void;
}) {
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const [kind, setKind] = useState(initial?.kind ?? RECORD_KINDS[0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(initial?.familyMemberId ?? null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const tags = normaliseTags(tagsRaw);
    try {
      if (mode === "create") {
        const out = await create.mutateAsync({
          kind,
          title: title.trim(),
          date,
          diagnosis: diagnosis.trim() || undefined,
          summary: summary.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tags.length ? tags : undefined,
          familyMemberId,
          recordDate: new Date(date).toISOString(),
        });
        onSuccess(out.id);
      } else {
        await update.mutateAsync({
          id: recordId!,
          title: title.trim(),
          diagnosis: diagnosis.trim() || undefined,
          summary: summary.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: tags.length ? tags : undefined,
          familyMemberId,
        });
        onSuccess(recordId!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="t-label">Kind</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RECORD_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={mode === "edit"}
              onClick={() => setKind(k)}
              className={[
                "rounded-full border px-3 py-1 text-xs transition-colors",
                kind === k
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-surface-2 text-text-muted hover:bg-surface-3",
                mode === "edit" && k !== kind ? "opacity-60" : "",
              ].join(" ")}
            >
              {RECORD_REGISTRY[k].labelKey.split(".").pop()}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="t-label">Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="CBC 2026-08-15"
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Diagnosis</span>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={2}
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Summary</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Tags</span>
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="annual, fasting"
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        />
        <span className="t-micro">Lowercase, comma-separated, ≤40 chars each.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="t-label">Family member</span>
        <select
          value={familyMemberId ?? ""}
          onChange={(e) => setFamilyMemberId(e.target.value || null)}
          className="rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          <option value="">Myself</option>
          {/* family picker wiring lives in SP8; show ID-only stub for now */}
        </select>
      </label>

      {error ? <Pill tone="danger">{error}</Pill> : null}

      <button
        type="submit"
        disabled={create.isPending || update.isPending}
        className="self-start rounded-inner bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Save
      </button>
    </form>
  );
}
```

(Note: Pill tone "danger" may not exist — fall back to "warning" if your primitive doesn't define "danger". Verify against `apps/marketing/src/patient/components/primitives/Pill.tsx`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordForm.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/records/RecordForm.tsx apps/marketing/src/patient/components/records/RecordForm.test.tsx
git commit -m "feat(patient): shared RecordForm component for create/edit"
```

---

### Task 8: Build `RecordActionsBar` component

**Files:**
- Create: `apps/marketing/src/patient/components/records/RecordActionsBar.tsx`
- Create: `apps/marketing/src/patient/components/records/RecordActionsBar.test.tsx`

**Interfaces:**
- Consumes: `useArchiveRecord`, `useRestoreRecord`, `useMoveRecord`, `useDeleteRecord`, `useReExtractRecord`, `toast`
- Produces: row of action buttons with correct enabled state

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/patient/components/records/RecordActionsBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const archive = vi.fn();
const restore = vi.fn();
const move = vi.fn();
const del = vi.fn();
const reextract = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@/patient/hooks", () => ({
  useArchiveRecord: () => ({ mutateAsync: archive, isPending: false }),
  useRestoreRecord: () => ({ mutateAsync: restore, isPending: false }),
  useMoveRecord: () => ({ mutateAsync: move, isPending: false }),
  useDeleteRecord: () => ({ mutateAsync: del, isPending: false }),
  useReExtractRecord: () => ({ mutateAsync: reextract, isPending: false }),
}));
vi.mock("@/portal/components/ui/Toast", () => ({ toast }));

import { RecordActionsBar } from "./RecordActionsBar";

describe("RecordActionsBar", () => {
  it("renders Edit, Archive, Move, Re-extract, Delete buttons", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={true}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^re-extract$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeTruthy();
  });

  it("shows Restore instead of Archive when archived=true", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={true}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^restore$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^archive$/i })).toBeNull();
  });

  it("disables Re-extract when no attachments", () => {
    render(
      <RecordActionsBar
        recordId="r1"
        archived={false}
        hasAttachments={false}
        onEdit={() => {}}
        onDeleteSuccess={() => {}}
      />,
    );
    expect((screen.getByRole("button", { name: /^re-extract$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls archive then toasts on click", async () => {
    archive.mockResolvedValueOnce({});
    render(
      <RecordActionsBar recordId="r1" archived={false} hasAttachments={false} onEdit={() => {}} onDeleteSuccess={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith("r1"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("confirms then deletes", async () => {
    del.mockResolvedValueOnce({});
    const onDeleteSuccess = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <RecordActionsBar recordId="r1" archived={false} hasAttachments={false} onEdit={() => {}} onDeleteSuccess={onDeleteSuccess} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("r1"));
    expect(onDeleteSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordActionsBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// apps/marketing/src/patient/components/records/RecordActionsBar.tsx
"use client";

import { useArchiveRecord, useDeleteRecord, useMoveRecord, useReExtractRecord, useRestoreRecord } from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";

export function RecordActionsBar({
  recordId,
  archived,
  hasAttachments,
  onEdit,
  onDeleteSuccess,
}: {
  recordId: string;
  archived: boolean;
  hasAttachments: boolean;
  onEdit: () => void;
  onDeleteSuccess: () => void;
}) {
  const archive = useArchiveRecord();
  const restore = useRestoreRecord();
  const move = useMoveRecord();
  const del = useDeleteRecord();
  const reextract = useReExtractRecord(recordId);

  async function onArchive() {
    try {
      await archive.mutateAsync(recordId);
      toast.success("Record archived");
    } catch (e) {
      toast.error("Could not archive", e instanceof Error ? e.message : undefined);
    }
  }

  async function onRestore() {
    try {
      await restore.mutateAsync(recordId);
      toast.success("Record restored");
    } catch (e) {
      toast.error("Could not restore", e instanceof Error ? e.message : undefined);
    }
  }

  async function onReturn() {
    try {
      await move.mutateAsync({ id: recordId, familyMemberId: null });
      toast.success("Returned to you");
    } catch (e) {
      toast.error("Could not move", e instanceof Error ? e.message : undefined);
    }
  }

  async function onReextract() {
    try {
      await reextract.mutateAsync();
      toast.success("Re-extraction queued");
    } catch (e) {
      toast.error("Could not re-extract", e instanceof Error ? e.message : undefined);
    }
  }

  function onDelete() {
    if (!window.confirm("Delete this record permanently? This cannot be undone.")) return;
    del
      .mutateAsync(recordId)
      .then(() => {
        toast.success("Record deleted");
        onDeleteSuccess();
      })
      .catch((e) => toast.error("Could not delete", e instanceof Error ? e.message : undefined));
  }

  const btnCls = "rounded-inner border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onEdit} className={btnCls}>
        Edit
      </button>
      {archived ? (
        <button type="button" onClick={onRestore} className={btnCls} disabled={restore.isPending}>
          Restore
        </button>
      ) : (
        <button type="button" onClick={onArchive} className={btnCls} disabled={archive.isPending}>
          Archive
        </button>
      )}
      <button type="button" onClick={onReturn} className={btnCls} disabled={move.isPending}>
        Return to me
      </button>
      <button
        type="button"
        onClick={onReextract}
        className={btnCls}
        disabled={!hasAttachments || reextract.isPending}
        title={!hasAttachments ? "Attach a file first" : "Re-run extraction on the first attached file"}
      >
        Re-extract
      </button>
      <button type="button" onClick={onDelete} className={btnCls + " text-red-600"} disabled={del.isPending}>
        Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordActionsBar.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/records/RecordActionsBar.tsx apps/marketing/src/patient/components/records/RecordActionsBar.test.tsx
git commit -m "feat(patient): RecordActionsBar component"
```

---

### Task 9: Build `RecordAttachmentsSection` component

**Files:**
- Create: `apps/marketing/src/patient/components/records/RecordAttachmentsSection.tsx`
- Create: `apps/marketing/src/patient/components/records/RecordAttachmentsSection.test.tsx`

**Interfaces:**
- Consumes: `useRecordAttachments`, `useAddAttachment`, `useDeleteAttachment`, `usePresignAttachment`, `toast`
- Produces: list + add/delete/download

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/patient/components/records/RecordAttachmentsSection.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refetch = vi.fn();
const addMut = vi.fn();
const delMut = vi.fn();
const presignMut = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@/patient/hooks", () => ({
  useRecordAttachments: () => ({
    data: { files: [{ id: "f1", fileName: "lab.pdf", mimeType: "application/pdf", size: 1024, uploadedAt: "2026-08-01" }] },
    isLoading: false,
    refetch,
  }),
  useAddAttachment: () => ({ mutateAsync: addMut, isPending: false }),
  useDeleteAttachment: () => ({ mutateAsync: delMut, isPending: false }),
  usePresignAttachment: () => ({ mutateAsync: presignMut, isPending: false }),
}));
vi.mock("@/portal/components/ui/Toast", () => ({ toast }));

const openSpy = vi.fn();
vi.stubGlobal("open", openSpy);

import { RecordAttachmentsSection } from "./RecordAttachmentsSection";

describe("RecordAttachmentsSection", () => {
  it("renders one row per file with Download + Delete buttons", () => {
    render(<RecordAttachmentsSection recordId="r1" />);
    expect(screen.getByText("lab.pdf")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeTruthy();
  });

  it("presigns and opens the URL on Download click", async () => {
    presignMut.mockResolvedValueOnce({ token: "t", expiresAt: "x", url: "https://example.com/d" });
    render(<RecordAttachmentsSection recordId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /^download$/i }));
    await waitFor(() => expect(presignMut).toHaveBeenCalledWith({ fileId: "f1" }));
    expect(openSpy).toHaveBeenCalledWith("https://example.com/d", "_blank", "noopener,noreferrer");
  });

  it("confirms then deletes", async () => {
    delMut.mockResolvedValueOnce({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RecordAttachmentsSection recordId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(delMut).toHaveBeenCalledWith({ id: "f1", recordId: "r1" }));
  });

  it("rejects a 51MB file before submitting", async () => {
    render(<RecordAttachmentsSection recordId="r1" />);
    const input = screen.getByLabelText(/add attachment/i) as HTMLInputElement;
    const big = new File([new Uint8Array(51 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(addMut).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("uploads a valid file via FormData", async () => {
    addMut.mockResolvedValueOnce({ file: { id: "f2" } });
    render(<RecordAttachmentsSection recordId="r1" />);
    const input = screen.getByLabelText(/add attachment/i) as HTMLInputElement;
    const file = new File(["x"], "ok.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(addMut).toHaveBeenCalledWith({ file }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordAttachmentsSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// apps/marketing/src/patient/components/records/RecordAttachmentsSection.tsx
"use client";

import { useRef } from "react";
import { useAddAttachment, useDeleteAttachment, usePresignAttachment, useRecordAttachments } from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RecordAttachmentsSection({ recordId }: { recordId: string }) {
  const query = useRecordAttachments(recordId);
  const add = useAddAttachment(recordId);
  const del = useDeleteAttachment();
  const presign = usePresignAttachment();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", "Max 50 MB");
      e.target.value = "";
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Unsupported file type", `${file.type || "unknown"} not allowed`);
      e.target.value = "";
      return;
    }
    try {
      await add.mutateAsync({ file });
      toast.success("Attachment uploaded");
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      e.target.value = "";
    }
  }

  async function onDownload(fileId: string) {
    try {
      const { url } = await presign.mutateAsync({ fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Could not download", err instanceof Error ? err.message : undefined);
    }
  }

  function onDelete(fileId: string) {
    if (!window.confirm("Delete this attachment?")) return;
    del
      .mutateAsync({ id: fileId, recordId })
      .then(() => toast.success("Attachment deleted"))
      .catch((e) => toast.error("Delete failed", e instanceof Error ? e.message : undefined));
  }

  const files = query.data?.files ?? [];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="t-section-title">Attachments</h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-inner border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3"
          disabled={add.isPending}
        >
          Add attachment
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED.join(",")}
          onChange={onPick}
          aria-label="Add attachment"
          className="hidden"
        />
      </header>

      {files.length === 0 ? (
        <p className="t-micro">No attachments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-inner bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.fileName}</p>
                <p className="t-micro">
                  {f.mimeType} · {humanSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onDownload(f.id)}
                  className="rounded-inner border border-border bg-surface-1 px-2 py-1 text-xs hover:bg-surface-3"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  className="rounded-inner border border-border bg-surface-1 px-2 py-1 text-xs text-red-600 hover:bg-surface-3"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/RecordAttachmentsSection.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/records/RecordAttachmentsSection.tsx apps/marketing/src/patient/components/records/RecordAttachmentsSection.test.tsx
git commit -m "feat(patient): RecordAttachmentsSection with upload/download/delete"
```

---

### Task 10: Build `StructuredChildren` + 5 child components

**Files:**
- Create: `apps/marketing/src/patient/components/records/StructuredChildren.tsx`
- Create: `apps/marketing/src/patient/components/records/LabResultsTable.tsx`
- Create: `apps/marketing/src/patient/components/records/ImagingFindingsCard.tsx`
- Create: `apps/marketing/src/patient/components/records/DischargeEventsList.tsx`
- Create: `apps/marketing/src/patient/components/records/VaccinationDosesList.tsx`
- Create: `apps/marketing/src/patient/components/records/PrescriptionItemsList.tsx`
- Create: `apps/marketing/src/patient/components/records/StructuredChildren.test.tsx`

**Interfaces:**
- Consumes: 5 child hooks + `RecordAttachmentsSection` for re-extract CTA (optional)
- Produces: switch on `kind` → matching component, nothing for other kinds

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/patient/components/records/StructuredChildren.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useRecordLabResults: () => ({ data: { items: [{ id: "lr1", test: "WBC", value: "6", unit: "x10^9/L", referenceRange: "4-11", flag: "normal", collectedAt: "2026-08-01" }] }, isLoading: false }),
  useRecordImagingFindings: () => ({ data: { item: { id: "if1", modality: "MRI", impression: "Torn meniscus" } }, isLoading: false }),
  useRecordDischargeEvents: () => ({ data: { item: { id: "de1", date: "2026-07-20", description: "Discharged" } }, isLoading: false }),
  useRecordVaccinationDoses: () => ({ data: { items: [{ id: "vd1", vaccineName: "Flu", dose: "1", date: "2026-08-01", lot: "L1", administeredBy: "Dr X" }] }, isLoading: false }),
  useRecordPrescriptionItems: () => ({ data: { items: [{ id: "pi1", name: "Metformin", dosage: "500mg", frequency: "BID", timing: "after meal" }] }, isLoading: false }),
}));

import { StructuredChildren } from "./StructuredChildren";

describe("StructuredChildren", () => {
  it("renders LabResultsTable when kind=lab_report", () => {
    render(<StructuredChildren recordId="r1" kind="lab_report" />);
    expect(screen.getByText(/WBC/)).toBeTruthy();
  });
  it("renders ImagingFindingsCard when kind=imaging", () => {
    render(<StructuredChildren recordId="r1" kind="imaging" />);
    expect(screen.getByText(/MRI/)).toBeTruthy();
  });
  it("renders DischargeEventsList when kind=discharge_summary", () => {
    render(<StructuredChildren recordId="r1" kind="discharge_summary" />);
    expect(screen.getByText(/Discharged/)).toBeTruthy();
  });
  it("renders VaccinationDosesList when kind=vaccination", () => {
    render(<StructuredChildren recordId="r1" kind="vaccination" />);
    expect(screen.getByText(/Flu/)).toBeTruthy();
  });
  it("renders PrescriptionItemsList when kind=prescription", () => {
    render(<StructuredChildren recordId="r1" kind="prescription" />);
    expect(screen.getByText(/Metformin/)).toBeTruthy();
  });
  it("renders nothing for unrelated kinds", () => {
    const { container } = render(<StructuredChildren recordId="r1" kind="referral" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/StructuredChildren.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the 6 components**

`apps/marketing/src/patient/components/records/StructuredChildren.tsx`:

```tsx
"use client";

import { useRecordDischargeEvents, useRecordImagingFindings, useRecordLabResults, useRecordPrescriptionItems, useRecordVaccinationDoses } from "@/patient/hooks";
import { LabResultsTable } from "./LabResultsTable";
import { ImagingFindingsCard } from "./ImagingFindingsCard";
import { DischargeEventsList } from "./DischargeEventsList";
import { VaccinationDosesList } from "./VaccinationDosesList";
import { PrescriptionItemsList } from "./PrescriptionItemsList";

export function StructuredChildren({ recordId, kind }: { recordId: string; kind: string }) {
  switch (kind) {
    case "lab_report":
      return <LabResultsTable recordId={recordId} />;
    case "imaging":
      return <ImagingFindingsCard recordId={recordId} />;
    case "discharge_summary":
      return <DischargeEventsList recordId={recordId} />;
    case "vaccination":
      return <VaccinationDosesList recordId={recordId} />;
    case "prescription":
      return <PrescriptionItemsList recordId={recordId} />;
    default:
      return null;
  }
}

// Re-export hooks used by tests below — these are referenced by name in the test file.
export { useRecordLabResults, useRecordImagingFindings, useRecordDischargeEvents, useRecordVaccinationDoses, useRecordPrescriptionItems };
```

`apps/marketing/src/patient/components/records/LabResultsTable.tsx`:

```tsx
"use client";

import { useRecordLabResults } from "@/patient/hooks";

export function LabResultsTable({ recordId }: { recordId: string }) {
  const q = useRecordLabResults(recordId);
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="t-micro">No lab results extracted yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-text-muted">
          <th className="py-1">Test</th>
          <th>Value</th>
          <th>Unit</th>
          <th>Range</th>
          <th>Flag</th>
          <th>Collected</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row: any) => (
          <tr key={row.id} className="border-t border-border/60">
            <td className="py-1">{row.test}</td>
            <td>{row.value}</td>
            <td>{row.unit ?? ""}</td>
            <td>{row.referenceRange ?? ""}</td>
            <td>{row.flag ?? ""}</td>
            <td>{new Date(row.collectedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`apps/marketing/src/patient/components/records/ImagingFindingsCard.tsx`:

```tsx
"use client";

import { useRecordImagingFindings } from "@/patient/hooks";

export function ImagingFindingsCard({ recordId }: { recordId: string }) {
  const q = useRecordImagingFindings(recordId);
  const item = q.data?.item;
  if (!item) return <p className="t-micro">No imaging findings extracted yet.</p>;
  return (
    <div className="flex flex-col gap-2 rounded-inner bg-surface-2 p-3">
      <p className="text-sm font-medium">{(item as any).modality}</p>
      <p className="t-micro">{(item as any).impression}</p>
    </div>
  );
}
```

`apps/marketing/src/patient/components/records/DischargeEventsList.tsx`:

```tsx
"use client";

import { useRecordDischargeEvents } from "@/patient/hooks";

export function DischargeEventsList({ recordId }: { recordId: string }) {
  const q = useRecordDischargeEvents(recordId);
  const item = q.data?.item;
  if (!item) return <p className="t-micro">No discharge events extracted yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      <li className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
        <p className="font-medium">{new Date((item as any).date).toLocaleDateString()}</p>
        <p className="t-micro">{(item as any).description}</p>
      </li>
    </ul>
  );
}
```

`apps/marketing/src/patient/components/records/VaccinationDosesList.tsx`:

```tsx
"use client";

import { useRecordVaccinationDoses } from "@/patient/hooks";

export function VaccinationDosesList({ recordId }: { recordId: string }) {
  const q = useRecordVaccinationDoses(recordId);
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="t-micro">No doses recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((d: any) => (
        <li key={d.id} className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">{d.vaccineName} {d.dose ? `· Dose ${d.dose}` : ""}</p>
          <p className="t-micro">
            {new Date(d.date).toLocaleDateString()}
            {d.lot ? ` · Lot ${d.lot}` : ""}
            {d.administeredBy ? ` · ${d.administeredBy}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
```

`apps/marketing/src/patient/components/records/PrescriptionItemsList.tsx`:

```tsx
"use client";

import { useRecordPrescriptionItems } from "@/patient/hooks";

export function PrescriptionItemsList({ recordId }: { recordId: string }) {
  const q = useRecordPrescriptionItems(recordId);
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="t-micro">No medicines on this prescription.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((m: any) => (
        <li key={m.id} className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">{m.name} {m.dosage ? `· ${m.dosage}` : ""}</p>
          <p className="t-micro">{[m.frequency, m.timing].filter(Boolean).join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/patient/components/records/StructuredChildren.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/records/
git commit -m "feat(patient): StructuredChildren with 5 kind-aware sub-components"
```

---

### Task 11: Build `/patient/records/new` page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/records/new/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/records/new/page.test.tsx`

**Interfaces:**
- Consumes: `RecordForm` component, `useRouter`
- Produces: create form page

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/app/patient/(app)/records/new/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({}));

import NewRecordPage from "./page";

describe("NewRecordPage", () => {
  it("renders the create form", () => {
    render(<NewRecordPage />);
    expect(screen.getByText(/Save/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/CBC/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run src/app/patient/\(app\)/records/new/page.test.tsx`
Expected: FAIL (page missing).

- [ ] **Step 3: Implement the page**

```tsx
// apps/marketing/src/app/patient/(app)/records/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { RecordForm } from "@/patient/components/records/RecordForm";

export default function NewRecordPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader
        label="Your file"
        title="New medical record"
        description="Capture a record from your file. You can attach files after creating it."
      />
      <Card>
        <RecordForm
          mode="create"
          onSuccess={(id) => router.push(`/patient/records/${id}`)}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run src/app/patient/\(app\)/records/new/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/records/new/"
git commit -m "feat(patient): /patient/records/new create page"
```

---

### Task 12: Build `/patient/records/[id]/edit` page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/records/[id]/edit/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/records/[id]/edit/page.test.tsx`

**Interfaces:**
- Consumes: `useRecord`, `RecordForm`, `useDeleteRecord`, `useRouter`
- Produces: pre-filled edit form + delete button

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/app/patient/(app)/records/[id]/edit/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useRecord: () => ({
    data: {
      id: "r1",
      recordType: "lab_report",
      title: "CBC",
      date: "2026-08-01",
      diagnosis: null,
      summary: null,
      tags: "annual,fasting",
      createdAt: "2026-08-01",
      status: null,
    },
    isLoading: false,
  }),
  useDeleteRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import EditRecordPage from "./page";

describe("EditRecordPage", () => {
  it("renders the edit form with prefilled values", () => {
    const params = Promise.resolve({ id: "r1" });
    render(<EditRecordPage params={params} />);
    const titleInput = screen.getByPlaceholderText(/CBC/i) as HTMLInputElement;
    expect(titleInput.value).toBe("CBC");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/edit/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement the page**

```tsx
// apps/marketing/src/app/patient/(app)/records/[id]/edit/page.tsx
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useDeleteRecord, useRecord } from "@/patient/hooks";
import { toast } from "@/portal/components/ui/Toast";
import { RecordForm } from "@/patient/components/records/RecordForm";

export default function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useRecord(id);
  const del = useDeleteRecord();

  function onDelete() {
    if (!window.confirm("Delete this record permanently?")) return;
    del
      .mutateAsync(id)
      .then(() => {
        toast.success("Record deleted");
        router.push("/patient/records");
      })
      .catch((e) => toast.error("Could not delete", e instanceof Error ? e.message : undefined));
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader
        label="Your file"
        title="Edit record"
        description="Update the metadata or delete the record entirely."
      />
      <Card>
        <QueryBoundary query={query} loadingCount={2} emptyTitle="No such record">
          {(data) => {
            const tags = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
            return (
              <div className="flex flex-col gap-6">
                <RecordForm
                  mode="edit"
                  recordId={id}
                  initial={{
                    kind: data.recordType,
                    title: data.title,
                    date: data.date.slice(0, 10),
                    diagnosis: data.diagnosis ?? undefined,
                    summary: data.summary ?? undefined,
                    tags,
                  }}
                  onSuccess={() => router.push(`/patient/records/${id}`)}
                />
                <hr className="border-border" />
                <button
                  type="button"
                  onClick={onDelete}
                  className="self-start rounded-inner border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  disabled={del.isPending}
                >
                  Delete this record
                </button>
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/edit/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/records/[id]/edit/"
git commit -m "feat(patient): /patient/records/[id]/edit page"
```

---

### Task 13: Expand `/patient/records/[id]` page

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `useRecord`, `useRecordAttachments`, `RecordActionsBar`, `RecordAttachmentsSection`, `StructuredChildren`
- Produces: header + actions + metadata + attachments + structured children

- [ ] **Step 1: Update the failing test**

Replace `apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useRecord: () => ({
    data: {
      id: "r1",
      recordType: "lab_report",
      title: "CBC",
      date: "2026-08-01",
      diagnosis: null,
      summary: null,
      tags: null,
      createdAt: "2026-08-01",
      status: null,
    },
    isLoading: false,
  }),
  useRecordAttachments: () => ({ data: { files: [] }, isLoading: false }),
}));

import RecordDetailPage from "./page";

describe("RecordDetailPage (expanded)", () => {
  it("renders metadata + actions + attachments + structured children sections", () => {
    const params = Promise.resolve({ id: "r1" });
    render(<RecordDetailPage params={params} />);
    expect(screen.getByText("CBC")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByText(/Attachments/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/page.test.tsx"`
Expected: FAIL (page doesn't render sections yet).

- [ ] **Step 3: Replace the page**

Replace `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecord, useRecordAttachments } from "@/patient/hooks";
import { RecordActionsBar } from "@/patient/components/records/RecordActionsBar";
import { RecordAttachmentsSection } from "@/patient/components/records/RecordAttachmentsSection";
import { StructuredChildren } from "@/patient/components/records/StructuredChildren";
import { formatDayLabel } from "@/patient/lib/format";

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useRecord(id);
  const attachments = useRecordAttachments(id);
  const files = attachments.data?.files ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <Card>
        <QueryBoundary
          query={query}
          loadingCount={2}
          emptyTitle="No such record"
          emptyDescription="We couldn't find that record on your file."
        >
          {(data) => (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="t-label">{data.recordType}</p>
                  <h1 className="t-card-title mt-1">{data.title}</h1>
                  <p className="t-micro mt-1">{formatDayLabel(data.date)}</p>
                </div>
                <Pill tone="info">{data.status ?? "—"}</Pill>
              </div>

              <RecordActionsBar
                recordId={id}
                archived={Boolean((data as any).archivedAt)}
                hasAttachments={files.length > 0}
                onEdit={() => router.push(`/patient/records/${id}/edit`)}
                onDeleteSuccess={() => router.push("/patient/records")}
              />

              {data.diagnosis ? (
                <div>
                  <p className="t-label">Diagnosis</p>
                  <p className="mt-1 text-sm text-text-soft">{data.diagnosis}</p>
                </div>
              ) : null}

              {data.summary ? (
                <div>
                  <p className="t-label">Summary</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-soft">
                    {data.summary}
                  </p>
                </div>
              ) : null}

              {data.tags ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <Pill key={t} tone="info">{t}</Pill>
                    ))}
                </div>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      </Card>

      <Card>
        <RecordAttachmentsSection recordId={id} />
      </Card>

      <Card>
        <QueryBoundary query={query} loadingCount={1} emptyTitle="">
          {(data) => (
            <StructuredChildren recordId={id} kind={data.recordType} />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/marketing && bunx vitest run "src/app/patient/(app)/records/[id]/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Run the full marketing test suite**

Run: `cd apps/marketing && bun run test 2>&1 | tail -30`
Expected: failure count ≤ 8 baseline. The pre-existing failing tests are listed below — any new failure must be diagnosed:

```
test(files:search): known pre-existing
test(medications:page): known pre-existing
test(notifications:preferences): known pre-existing
test(PatientShell): known pre-existing
test(RxActions): known pre-existing
+ 3 more
```

Count the actual fails from the output. If new fails appear, fix them before committing.

- [ ] **Step 6: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/records/[id]/page.tsx" "apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx"
git commit -m "feat(patient): expand record detail with actions, attachments, structured children"
```

---

### Task 14: Update parity manifest

**Files:**
- Modify: `docs/parity-manifest.md:25-26` (flip two rows, update one note)

**Interfaces:**
- Consumes: existing row format in `docs/parity-manifest.md`
- Produces: 2 rows flip to `done`, 1 row note updates

- [ ] **Step 1: Verify parity test will pass after the flip**

Run: `cd apps/marketing && bunx vitest run src/patient/parity.test.ts`
Expected: FAIL on the two rows still marked `planned`. (This confirms the test enforces what we're about to flip.)

- [ ] **Step 2: Edit the manifest**

In `docs/parity-manifest.md`, change line 25:

```
| `(app)/add-record` | `/patient/records/new` | planned | 2 | |
```

to:

```
| `(app)/add-record` | `/patient/records/new` | done | 2 | envelope-create; attachments added on detail |
```

Change line 26:

```
| `(app)/edit-record` | `/patient/records/[id]/edit` | planned | 2 | |
```

to:

```
| `(app)/edit-record` | `/patient/records/[id]/edit` | done | 2 | edit metadata + tags; delete inline |
```

Change line 24 note (the `(app)/record-detail` row):

from:

```
| `(app)/record-detail` | `/patient/records/[id]` | done | 0 | read-only; actions in 2 |
```

to:

```
| `(app)/record-detail` | `/patient/records/[id]` | done | 2 | actions bar (edit/archive/restore/move/re-extract/delete) + attachments + structured children |
```

- [ ] **Step 3: Run the parity test**

Run: `cd apps/marketing && bunx vitest run src/patient/parity.test.ts`
Expected: PASS — every `done` row resolves to a real page file.

- [ ] **Step 4: Run the full suite once more**

Run: `cd apps/marketing && bun run test 2>&1 | tail -10`
Expected: failure count ≤ 8 baseline.

- [ ] **Step 5: Commit**

```bash
git add docs/parity-manifest.md
git commit -m "docs(parity): records write-path pages done under /patient"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 — Definition of done (1) new page | T11 |
| §1 — Definition of done (2) edit page | T12 |
| §1 — Definition of done (3) detail expansion | T13 |
| §1 — Definition of done (4) attachments section | T9 |
| §1 — Definition of done (5) structured children | T10 |
| §1 — Definition of done (6) key invalidations | T4, T5, T6 |
| §1 — Definition of done (7) parity manifest | T14 |
| §1 — Definition of done (8) test count | T13 step 5, T14 step 4 |
| §1 — Definition of done (9) no new deps | global |
| §2.4 paths additions | T1 |
| §2.4 keys additions | T2 |
| §2.4 types additions | T3 |
| §2.5 hook additions | T4, T5, T6 |
| §3.3 actions bar | T8 |
| §3.4 attachments | T9 |
| §3.5 structured children | T10 |

All spec requirements have a task. No gaps.

**Placeholder scan:** no TBD/TODO/"implement later"/"add appropriate error handling" in the plan.

**Type consistency:**

- `patientPaths.records.create()` → `/medical-records/envelope` (T1, T5 `useCreateRecord`) ✓
- `patientPaths.records.update(id)` → `/medical-records/{id}` (T1, T5 mutations) ✓
- `patientPaths.records.delete(id)` → `/medical-records/{id}` (T1, T5 `useDeleteRecord`) ✓
- `patientPaths.records.attachmentUpload()` → `/files/upload` (T1, T6 `useAddAttachment`) ✓
- `patientPaths.records.attachmentDelete(id)` → `/files/{id}` (T1, T6 `useDeleteAttachment`) ✓
- `patientPaths.records.attachmentPresign()` → `/files/presign` (T1, T6 `usePresignAttachment`) ✓
- `patientPaths.records.reExtract(id)` → `/medical-records/{id}/re-extract` (T1, T6 `useReExtractRecord`) ✓
- `patientKeys.recordAttachments(id)` (T2, T4 `useRecordAttachments`) ✓
- `patientKeys.recordChildren(id, kind)` (existing, T4) ✓
- `RecordCreateInput.kind: string` (T3, T7 RecordForm) ✓
- `RecordUpdateInput.id: string` + spread (T3, T5 `useUpdateRecord`) ✓
- `RecordAttachment.{id, recordId, fileName, mimeType, size, uploadedAt}` (T3, T4, T9) ✓
- Hook signatures match test expectations across T4-T6.

All consistent.