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
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex-1 cursor-default"
      />
      <div
        className={cn(
          "relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-2xl border-l border-slate-200 z-10",
          side === "right" ? "ml-auto" : "mr-auto",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
