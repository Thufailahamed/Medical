import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { ChatComposer } from "./ChatComposer";

function Harness({ onSend }: { onSend: () => void }) {
  const [value, setValue] = useState("");
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSend={onSend}
      onStop={vi.fn()}
      busy={false}
      useEhr
      onToggleEhr={vi.fn()}
    />
  );
}

describe("ChatComposer", () => {
  it("sends with Enter but not Shift+Enter", () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    const textarea = screen.getByLabelText("Message HealthHub");

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps send disabled until text is present", async () => {
    const user = userEvent.setup();
    render(<Harness onSend={vi.fn()} />);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Message HealthHub"), "Hi");
    expect(send).not.toBeDisabled();
  });

  it("toggles EHR sync", async () => {
    const user = userEvent.setup();
    const onToggleEhr = vi.fn();
    render(
      <ChatComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy={false}
        useEhr
        onToggleEhr={onToggleEhr}
      />,
    );
    await user.click(screen.getByRole("button", { name: /EHR/i }));
    expect(onToggleEhr).toHaveBeenCalledWith(false);
  });

  it("shows Stop while busy", () => {
    render(
      <ChatComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy
        useEhr
        onToggleEhr={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Stop/i })).toBeTruthy();
  });
});
