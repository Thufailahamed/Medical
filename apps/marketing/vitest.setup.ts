import "@testing-library/jest-dom/vitest";

// next/navigation is invoked by every portal page / sidebar link.
// In unit tests we never want to actually navigate; stub it.
import { vi } from "vitest";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/portal/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// next/link is a no-op for tests — render an actual <a> with the
// children + href so screen.getByRole("link") works.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) =>
    React.createElement("a", { href, ...rest }, children),
}));

// next/font is a build-time optimisation; in tests we don't load fonts.
vi.mock("next/font", () => ({
  default: () => ({}),
}));

// Portal API wrapper. Tests cover UI behaviour, not network IO.
// Each test mocks `api` to return canned data via vi.mocked(api).
// We don't replace the global here because mocking per-test with
// vi.mock("@/portal/lib/api") is clearer than a global stub.
