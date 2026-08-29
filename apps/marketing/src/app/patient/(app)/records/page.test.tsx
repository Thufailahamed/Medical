import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useRecords: () => ({ data: { records: [] }, isLoading: false, isError: false }),
  useRecordStats: () => ({ data: { total: 0, byType: {} }, isLoading: false, isError: false }),
}));

import RecordsListPage from "./page";

describe("RecordsListPage", () => {
  it("renders the section header", () => {
    render(<RecordsListPage />);
    expect(screen.getByText(/Medical records/)).toBeTruthy();
  });
});
