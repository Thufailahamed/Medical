import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, generateMock, checkMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  generateMock: vi.fn(),
  checkMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/patient/hooks", () => ({
  usePatientProfile: () => ({
    data: { patient: { patients: { id: "p1" }, users: { name: "Anya Perera" } } },
    isLoading: false,
  }),
  useMedications: () => ({
    data: { medicines: [{ name: "Metformin" }, { name: "Atorvastatin" }] },
    isLoading: false,
  }),
  useGenerateSummary: () => ({ mutateAsync: generateMock, isPending: false }),
  useCheckDrugInteractions: () => ({ mutateAsync: checkMock, isPending: false }),
}));

import AiToolsPage from "./page";

describe("AiToolsPage", () => {
  it("renders the hero, both primary cards and all six tools", () => {
    render(<AiToolsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /AI health assistant/i }),
    ).toBeTruthy();
    expect(screen.getByText("Health record summary")).toBeTruthy();
    expect(screen.getByText("Medication safety")).toBeTruthy();
    for (const name of [
      "Care Chat",
      "Lab Interpreter",
      "Document OCR",
      "Health Trends",
      "Clinical Note",
      "Vaccination Card",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText(/Clinical safety notice/i)).toBeTruthy();
  });

  it("routes command bar submissions to chat with the prompt", async () => {
    const user = userEvent.setup();
    render(<AiToolsPage />);
    await user.type(screen.getByLabelText("Ask the AI assistant"), "Why am I tired?");
    await user.click(screen.getByRole("button", { name: /Ask AI/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/patient/ai/chat?prompt=" + encodeURIComponent("Why am I tired?"),
    );
  });

  it("links every tool to its route", () => {
    render(<AiToolsPage />);
    for (const href of [
      "/patient/ai/chat",
      "/patient/ai/lab-explain",
      "/patient/ai/ocr",
      "/patient/ai/lab-trend",
      "/patient/ai/clinical-note",
      "/patient/ai/vaccination-card",
    ]) {
      expect(
        screen.getAllByRole("link").some((a) => a.getAttribute("href") === href),
      ).toBe(true);
    }
  });
});
