"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/portal/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full bg-surface rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-border/70 overflow-hidden flex flex-col max-h-[90vh]",
          sizeMap[size]
        )}
      >
        <div className="px-6 py-4 border-b border-border/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-text">{title}</div>
            {subtitle ? (
              <div className="text-xs text-text-muted mt-0.5">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-border/60 bg-surface-2/30 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-in"
      style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "bg-surface h-full w-full flex flex-col border-l border-border/70 shadow-[0_20px_60px_rgba(0,0,0,0.12)]",
          widths[size]
        )}
      >
        <div className="px-6 py-4 border-b border-border/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-text">{title}</div>
            {subtitle ? (
              <div className="text-xs text-text-muted mt-0.5">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-border/60 bg-surface-2/30 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
