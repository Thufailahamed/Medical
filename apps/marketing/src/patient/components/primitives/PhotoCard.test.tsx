import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PhotoCard } from "./PhotoCard";

describe("PhotoCard", () => {
  it("renders image with alt and title", () => {
    const { getByAltText, getByText } = render(
      <PhotoCard imageSrc="https://example.com/doc.jpg" fallbackInitials="DR" alt="Dr Rao portrait" title="Dr Rao" />
    );
    expect(getByAltText("Dr Rao portrait")).toBeTruthy();
    expect(getByText("Dr Rao")).toBeTruthy();
  });

  it("falls back to initials when image errors", () => {
    const { getByAltText, getByText } = render(
      <PhotoCard imageSrc="https://example.com/broken.jpg" fallbackInitials="DR" alt="Dr Rao portrait" title="Dr Rao" />
    );
    fireEvent.error(getByAltText("Dr Rao portrait"));
    expect(getByText("DR")).toBeTruthy();
  });
});
