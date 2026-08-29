"use client";

import { useEffect } from "react";

import { cn } from "@/portal/lib/utils";

/**
 * Side-anchored panel — used by OrganDetailPanel and any future
 * "open detail beside" interactions. Locks body scroll while open and
 * dismisses on Escape. The mask and panel animate in with the rise
 * keyframe so it matches the rest of the surface.
 */
export function Sheet({
  open,
  onClose,
  side = "right",
  ariaLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
  ariaLabel: string;
  children?: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex-1 bg-black/40"
      />
      <div
        className={cn(
          "anim-rise flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-surface p-6 shadow-float",
          side === "right" ? "ml-auto" : "mr-auto",
          className
        )}
        style={{ borderTopLeftRadius: "var(--radius-card)", borderTopRightRadius: "var(--radius-card)" }}
      >
        {children}
      </div>
    </div>
  );
}
