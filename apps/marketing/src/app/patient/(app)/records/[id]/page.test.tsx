import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useRecord: () => ({ data: null, isLoading: false, isError: false }),
}));

import RecordDetailPage from "./page";

describe("RecordDetailPage", () => {
  it("renders without crashing when params is a Promise", () => {
    const params = Promise.resolve({ id: "rec-1" });
    const { container } = render(<RecordDetailPage params={params} />);
    expect(container).toBeTruthy();
  });
});
