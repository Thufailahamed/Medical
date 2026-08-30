import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/patient/hooks", () => ({
  useRecords: () => ({
    data: {
      records: [
        {
          id: "1",
          title: "Visit — Jul 10, 2026",
          date: "2026-07-10",
          recordType: "CLINICAL_NOTE",
          diagnosis: null,
        },
        {
          id: "2",
          title: "Test-2",
          date: "2026-06-30",
          recordType: "LAB_REPORT",
          diagnosis: null,
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useRecordStats: () => ({
    data: {
      total: 6,
      byType: {
        CLINICAL_NOTE: 1,
        LAB_REPORT: 2,
        PRESCRIPTION: 2,
        VACCINATION: 1,
      },
    },
    isLoading: false,
    isError: false,
  }),
  useRecordSearch: () => ({ data: { records: [] }, isLoading: false, isError: false }),
  useFamilyMembers: () => ({ data: { family: [] }, isLoading: false, isError: false }),
  useBulkArchiveRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkRestoreRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkDeleteRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkTagRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import RecordsListPage from "./page";

describe("RecordsListPage", () => {
  it("renders human-readable type labels and actions", () => {
    render(<RecordsListPage />);
    expect(screen.getByRole("link", { name: /Add record/i })).toBeTruthy();
    expect(screen.getAllByText(/Clinical note/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lab report/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/CLINICAL_NOTE/)).toBeNull();
    expect(screen.getByPlaceholderText(/Search by title/i)).toBeTruthy();
  });
});
