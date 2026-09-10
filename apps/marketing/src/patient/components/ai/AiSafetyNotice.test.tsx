import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AiSafetyNotice } from "./AiSafetyNotice";

describe("AiSafetyNotice", () => {
  it("states the clinical safety boundary", () => {
    render(<AiSafetyNotice />);
    expect(screen.getByText(/Clinical safety notice/i)).toBeTruthy();
    expect(screen.getByText(/does not replace emergency care/i)).toBeTruthy();
  });
});
