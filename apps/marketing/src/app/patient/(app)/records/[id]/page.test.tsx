import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

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
    isError: false,
  }),
  useRecordAttachments: () => ({ data: { files: [] }, isLoading: false }),
}));

import RecordDetailPage from "./page";

describe("RecordDetailPage (expanded)", () => {
  it("renders without crashing when params is a Promise", () => {
    const params = Promise.resolve({ id: "r1" });
    const { container } = render(<RecordDetailPage params={params} />);
    expect(container).toBeTruthy();
  });
});