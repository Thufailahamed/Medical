import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/portal/lib/api";

vi.mock("@/portal/lib/api", () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

const mockedApi = vi.mocked(api);

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockedApi.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

import {
  useAddAttachment,
  useArchiveRecord,
  useCreateRecord,
  useDeleteAttachment,
  useDeleteRecord,
  useMoveRecord,
  usePresignAttachment,
  useRecordAttachments,
  useRecordDischargeEvents,
  useRecordImagingFindings,
  useRecordLabResults,
  useRecordPrescriptionItems,
  useRecordVaccinationDoses,
  useReExtractRecord,
  useRestoreRecord,
  useUpdateRecord,
} from "../records";

describe("record read hooks (write-path additions)", () => {
  it("useRecordAttachments queries /files/record/:id", async () => {
    mockedApi.mockResolvedValueOnce({ files: [] });
    const { result } = renderHook(() => useRecordAttachments("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/files/record/r1");
  });

  it("useRecordLabResults hits lab-results child endpoint", async () => {
    mockedApi.mockResolvedValueOnce({ items: [] });
    const { result } = renderHook(() => useRecordLabResults("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/medical-records/r1/lab-results");
  });

  it("useRecordImagingFindings hits imaging-findings child endpoint", async () => {
    mockedApi.mockResolvedValueOnce({ item: null });
    const { result } = renderHook(() => useRecordImagingFindings("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/medical-records/r1/imaging-findings");
  });

  it("useRecordDischargeEvents hits discharge-events child endpoint", async () => {
    mockedApi.mockResolvedValueOnce({ item: null });
    const { result } = renderHook(() => useRecordDischargeEvents("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/medical-records/r1/discharge-events");
  });

  it("useRecordVaccinationDoses hits vaccination-doses child endpoint", async () => {
    mockedApi.mockResolvedValueOnce({ items: [] });
    const { result } = renderHook(() => useRecordVaccinationDoses("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/medical-records/r1/vaccination-doses");
  });

  it("useRecordPrescriptionItems hits prescription-items child endpoint", async () => {
    mockedApi.mockResolvedValueOnce({ items: [] });
    const { result } = renderHook(() => useRecordPrescriptionItems("r1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi).toHaveBeenCalledWith("/medical-records/r1/prescription-items");
  });
});

describe("record mutation hooks", () => {
  it("useCreateRecord posts to /medical-records/envelope", async () => {
    mockedApi.mockResolvedValueOnce({ id: "r1", envelopeVersion: "v1" });
    const { result } = renderHook(() => useCreateRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ kind: "lab_report", title: "x" });
    });
    expect(mockedApi).toHaveBeenCalledWith(
      "/medical-records/envelope",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("useUpdateRecord patches /medical-records/:id", async () => {
    mockedApi.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useUpdateRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: "r1", title: "y" });
    });
    expect(mockedApi).toHaveBeenCalledWith(
      "/medical-records/r1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("useDeleteRecord deletes /medical-records/:id", async () => {
    mockedApi.mockResolvedValueOnce({ message: "deleted" });
    const { result } = renderHook(() => useDeleteRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    expect(mockedApi).toHaveBeenCalledWith(
      "/medical-records/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("useArchiveRecord patches with {archived:true}", async () => {
    mockedApi.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useArchiveRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    const init = mockedApi.mock.calls.at(-1)![1] as { json: unknown };
    expect(init.json).toEqual({ archived: true });
  });

  it("useRestoreRecord patches with {archived:false}", async () => {
    mockedApi.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useRestoreRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync("r1");
    });
    const init = mockedApi.mock.calls.at(-1)![1] as { json: unknown };
    expect(init.json).toEqual({ archived: false });
  });

  it("useMoveRecord patches with familyMemberId", async () => {
    mockedApi.mockResolvedValueOnce({ record: { id: "r1" } });
    const { result } = renderHook(() => useMoveRecord(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: "r1", familyMemberId: "fm-2" });
    });
    const init = mockedApi.mock.calls.at(-1)![1] as { json: unknown };
    expect(init.json).toEqual({ familyMemberId: "fm-2" });
  });
});

describe("attachment + re-extract hooks", () => {
  it("useAddAttachment posts multipart FormData with recordId", async () => {
    mockedApi.mockResolvedValueOnce({ file: { id: "f1" } });
    const { result } = renderHook(() => useAddAttachment("r1"), { wrapper: makeWrapper() });
    const file = new File(["x"], "lab.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.mutateAsync({ file });
    });
    const [path, init] = mockedApi.mock.calls.at(-1)!;
    expect(path).toBe("/files/upload");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("useDeleteAttachment deletes /files/:id", async () => {
    mockedApi.mockResolvedValueOnce({ message: "deleted" });
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: "f1", recordId: "r1" });
    });
    expect(mockedApi).toHaveBeenCalledWith(
      "/files/f1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("usePresignAttachment posts to /files/presign", async () => {
    mockedApi.mockResolvedValueOnce({ token: "t", expiresAt: "x", url: "u" });
    const { result } = renderHook(() => usePresignAttachment(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ fileId: "f1" });
    });
    const init = mockedApi.mock.calls.at(-1)![1] as { json: unknown };
    expect(init.json).toEqual({ fileId: "f1" });
  });

  it("useReExtractRecord posts to /medical-records/:id/re-extract", async () => {
    mockedApi.mockResolvedValueOnce({ result: "ok" });
    const { result } = renderHook(() => useReExtractRecord("r1"), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mockedApi).toHaveBeenCalledWith(
      "/medical-records/r1/re-extract",
      expect.objectContaining({ method: "POST" }),
    );
  });
});