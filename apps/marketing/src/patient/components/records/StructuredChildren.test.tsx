import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/patient/hooks", () => ({
  useRecordLabResults: () => ({
    data: {
      items: [
        {
          id: "lr1",
          test: "WBC",
          value: "6",
          unit: "x10^9/L",
          referenceRange: "4-11",
          flag: "normal",
          collectedAt: "2026-08-01T00:00:00Z",
        },
      ],
    },
    isLoading: false,
  }),
  useRecordImagingFindings: () => ({
    data: { item: { id: "if1", modality: "MRI", impression: "Torn meniscus" } },
    isLoading: false,
  }),
  useRecordDischargeEvents: () => ({
    data: { item: { id: "de1", date: "2026-07-20", description: "Discharged" } },
    isLoading: false,
  }),
  useRecordVaccinationDoses: () => ({
    data: {
      items: [
        {
          id: "vd1",
          vaccineName: "Flu",
          dose: "1",
          date: "2026-08-01",
          lot: "L1",
          administeredBy: "Dr X",
        },
      ],
    },
    isLoading: false,
  }),
  useRecordPrescriptionItems: () => ({
    data: {
      items: [
        {
          id: "pi1",
          name: "Metformin",
          dosage: "500mg",
          frequency: "BID",
          timing: "after meal",
        },
      ],
    },
    isLoading: false,
  }),
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
    const { container } = render(
      <StructuredChildren recordId="r1" kind="referral" />,
    );
    expect(container.firstChild).toBeNull();
  });
});