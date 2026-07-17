// StudyList snapshot/render tests.
//
// Two surface checks:
//   - patientChart mode renders a row per study without a patient column
//   - empty state surfaces when the API returns no studies

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { StudyList } from "../StudyList";

const mockApi = vi.fn();

vi.mock("@/portal/lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
  qk: {
    imagingStudies: (params: unknown) => ["imaging", "studies", JSON.stringify(params)],
    imagingStudy: (uid: string) => ["imaging", "study", uid],
  },
}));

vi.mock("@/portal/i18n", () => ({
  useT: () => (key: string, vars?: Record<string, unknown>) => {
    if (key === "imaging.hub.seriesCount" && vars) {
      return `${vars.series} series · ${vars.instances} instances`;
    }
    return key;
  },
}));

vi.mock("@/portal/lib/format", () => ({
  formatDate: (d: string) => d,
}));

function withQuery(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  mockApi.mockReset();
});

describe("StudyList", () => {
  it("renders one row per study in patientChart mode", async () => {
    mockApi.mockResolvedValueOnce({
      studies: [
        {
          studyInstanceUid: "1.2.840.0.1",
          modalities: ["CT"],
          bodyParts: ["CHEST"],
          studyDate: "20260710",
          seriesCount: 2,
          instanceCount: 64,
          uploadedAt: "2026-07-10T10:00:00Z",
          patient: null,
        },
      ],
    });
    render(
      withQuery(
        <StudyList patientId="p1" mode="patientChart" />
      )
    );
    await waitFor(() => {
      expect(screen.getByText("1.2.840.0.1")).toBeTruthy();
    });
    expect(screen.getByText("CT")).toBeTruthy();
    expect(screen.getByText("CHEST")).toBeTruthy();
    expect(screen.getByText("2 series · 64 instances")).toBeTruthy();
  });

  it("renders empty state when API returns no studies", async () => {
    mockApi.mockResolvedValueOnce({ studies: [] });
    render(
      withQuery(
        <StudyList patientId="p1" mode="patientChart" />
      )
    );
    await waitFor(() => {
      expect(screen.getByText("imaging.hub.empty")).toBeTruthy();
    });
  });
});
