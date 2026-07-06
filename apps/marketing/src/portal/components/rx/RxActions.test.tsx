/**
 * RxActions — status × mode matrix tests.
 *
 * Pins the action affordance for each (status, mode) pair so a future
 * refactor of the component can't quietly drop a button. The mode
 * distinction is the load-bearing one: pharmacy mode hides Edit/Sign
 * and shows Dispense + Reject; doctor mode shows Edit/Sign/Cancel
 * but NOT Dispense (except via the parent detail page).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the auth store to give useT() a sane locale.
vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: "test-token", locale: "en", user: null }),
  useAuthStoreGetState: () => ({ token: "test-token", locale: "en" }),
}));

// Mock all mutation hooks so we don't pull in TanStack Query plumbing.
// Each returns a stub mutation object that records calls.
const mockSign = { mutateAsync: vi.fn(), isPending: false };
const mockCancel = { mutateAsync: vi.fn(), isPending: false };
const mockDoctorDispense = { mutateAsync: vi.fn(), isPending: false };
const mockPharmacyDispense = { mutateAsync: vi.fn(), isPending: false };
const mockPharmacyReject = { mutateAsync: vi.fn(), isPending: false };
const mockDownload = vi.fn();

vi.mock("@/portal/hooks/usePrescription", () => ({
  useSignPrescription: () => mockSign,
  useCancelPrescription: () => mockCancel,
  useDispensePrescription: () => mockDoctorDispense,
  usePharmacyDispense: () => mockPharmacyDispense,
  usePharmacyReject: () => mockPharmacyReject,
  downloadPrescriptionPdf: (...args: any[]) => mockDownload(...args),
}));

// Toast: stub so we don't depend on its real impl.
vi.mock("@/portal/components/ui/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { RxActions } from "./RxActions";

describe("RxActions", () => {
  it("doctor mode: draft renders Edit + Sign, hides Dispense", () => {
    render(<RxActions id="rx-1" status="draft" />);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dispense/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reject/i })
    ).not.toBeInTheDocument();
  });

  it("doctor mode: signed renders Download PDF + Cancel, hides Dispense+Reject", () => {
    render(<RxActions id="rx-2" status="signed" />);
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dispense/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reject/i })
    ).not.toBeInTheDocument();
  });

  it("doctor mode: cancelled renders nothing", () => {
    render(<RxActions id="rx-3" status="cancelled" />);
    expect(
      screen.queryByRole("button", { name: /edit|sign|dispense|reject|download|cancel/i })
    ).not.toBeInTheDocument();
  });

  it("doctor mode: dispensed renders nothing", () => {
    render(<RxActions id="rx-4" status="dispensed" />);
    expect(
      screen.queryByRole("button", { name: /edit|sign|dispense|reject|download|cancel/i })
    ).not.toBeInTheDocument();
  });

  it("pharmacy mode: draft renders nothing (pharmacy doesn't see drafts)", () => {
    render(<RxActions id="rx-5" status="draft" mode="pharmacy" />);
    expect(
      screen.queryByRole("button", { name: /edit|sign|dispense|reject|download|cancel/i })
    ).not.toBeInTheDocument();
  });

  it("pharmacy mode: signed renders Dispense + Reject, hides Edit/Sign/Download/Cancel", () => {
    render(<RxActions id="rx-6" status="signed" mode="pharmacy" />);
    expect(
      screen.getByRole("button", { name: /dispense/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^sign$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /download pdf/i })
    ).not.toBeInTheDocument();
    // Doctor's "Cancel" label must NOT appear; only Reject.
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("pharmacy mode: cancelled renders nothing", () => {
    render(<RxActions id="rx-7" status="cancelled" mode="pharmacy" />);
    expect(
      screen.queryByRole("button", { name: /edit|sign|dispense|reject|download|cancel/i })
    ).not.toBeInTheDocument();
  });

  it("pharmacy mode: dispensed renders nothing", () => {
    render(<RxActions id="rx-8" status="dispensed" mode="pharmacy" />);
    expect(
      screen.queryByRole("button", { name: /edit|sign|dispense|reject|download|cancel/i })
    ).not.toBeInTheDocument();
  });

  it("doctor mode: clicks Sign → calls useSignPrescription.mutateAsync", async () => {
    const user = userEvent.setup();
    render(<RxActions id="rx-9" status="draft" />);
    await user.click(screen.getByRole("button", { name: /^sign$/i }));
    expect(mockSign.mutateAsync).toHaveBeenCalledWith({ id: "rx-9" });
  });

  it("pharmacy mode: clicks Dispense → calls usePharmacyDispense.mutateAsync", async () => {
    const user = userEvent.setup();
    render(<RxActions id="rx-10" status="signed" mode="pharmacy" />);
    await user.click(screen.getByRole("button", { name: /dispense/i }));
    expect(mockPharmacyDispense.mutateAsync).toHaveBeenCalledWith("rx-10");
  });

  it("pharmacy mode: clicks Reject → opens modal with reason textarea", async () => {
    const user = userEvent.setup();
    render(<RxActions id="rx-11" status="signed" mode="pharmacy" />);
    await user.click(screen.getByRole("button", { name: /reject/i }));
    expect(
      screen.getByRole("dialog") ||
        screen.getByText(/reject prescription/i)
    ).toBeTruthy();
  });
});