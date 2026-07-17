// DicomViewer smoke test.
//
// Verifies that the viewer chrome (toolbar with download + carousel,
// modality pill, file name) renders without crashing. The Tier 1 MVP
// defers the actual WebGL render — the viewer surfaces a download CTA
// in place of a Cornerstone canvas so end-to-end RBAC + token flow can
// be exercised through the imaging API surface before committing to the
// v5 RenderingEngine integration.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { DicomViewer } from "../DicomViewer";

beforeEach(() => {
  // happy-dom doesn't ship window.location.origin defaults.
  if (typeof window !== "undefined" && !window.location.origin) {
    Object.defineProperty(window.location, "origin", {
      value: "http://localhost:3000",
      configurable: true,
    });
  }
});

describe("DicomViewer", () => {
  it("renders a download control and surfaces modality + file name", () => {
    render(
      <DicomViewer
        instances={[
          {
            viewerUrl: "/files/download/abc123",
            modality: "CT",
            fileName: "ct-001.dcm",
          },
        ]}
      />
    );
    // Toolbar buttons render with lucide icons + aria-labels.
    expect(screen.getByRole("button", { name: /download dicom/i })).toBeTruthy();
    // Modality pill surfaces the modality code.
    expect(screen.getByText("CT")).toBeTruthy();
    // File name shows in the chrome.
    expect(screen.getByText("ct-001.dcm")).toBeTruthy();
  });

  it("renders prev/next controls when more than one instance", () => {
    render(
      <DicomViewer
        instances={[
          { viewerUrl: "/files/download/a", modality: "CT" },
          { viewerUrl: "/files/download/b", modality: "CT" },
          { viewerUrl: "/files/download/c", modality: "CT" },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: /previous image/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /next image/i })).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });
});
