/**
 * Legacy /portal/login now redirects to the unified /login surface.
 */

import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import PortalLoginRedirect from "./page";

describe("PortalLoginRedirect", () => {
  it("redirects to /login?port=doctor", async () => {
    await PortalLoginRedirect({
      searchParams: Promise.resolve({ next: "/portal/dashboard" }),
    });
    expect(redirect).toHaveBeenCalledWith(
      "/login?port=doctor&next=%2Fportal%2Fdashboard",
    );
  });

  it("omits next when absent", async () => {
    await PortalLoginRedirect({
      searchParams: Promise.resolve({}),
    });
    expect(redirect).toHaveBeenCalledWith("/login?port=doctor");
  });
});
