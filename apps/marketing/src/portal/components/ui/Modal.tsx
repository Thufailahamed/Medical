"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

const modalSizes = {
  sm: "portal-modal-sm",
  md: "portal-modal-md",
  lg: "portal-modal-lg",
  xl: "portal-modal-xl",
} as const;

const drawerSizes = {
  sm: "portal-drawer-sm",
  md: "portal-drawer-md",
  lg: "portal-drawer-lg",
  xl: "portal-drawer-xl",
} as const;

function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  return mounted;
}

function OverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div data-app="portal" className="portal-overlay-root">
      {children}
    </div>,
    document.body
  );
}

function OverlayHeader({
  title,
  subtitle,
  onClose,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="portal-overlay-header">
      <div className="min-w-0">
        <div className="portal-overlay-title">{title}</div>
        {subtitle ? (
          <div className="portal-overlay-subtitle">{subtitle}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="portal-overlay-close"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const mounted = useOverlay(open, onClose);
  if (!open || !mounted) return null;

  return (
    <OverlayPortal>
      <div className="portal-overlay-host">
        <div
          className="portal-overlay-backdrop"
          aria-hidden="true"
          onMouseDown={onClose}
        />
        <div
          className={cn("portal-modal-panel", modalSizes[size])}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
          <div className="portal-overlay-body">{children}</div>
          {footer ? (
            <div className="portal-overlay-footer">{footer}</div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
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
  const mounted = useOverlay(open, onClose);
  if (!open || !mounted) return null;

  return (
    <OverlayPortal>
      <div className="portal-overlay-host">
        <div
          className="portal-overlay-backdrop"
          aria-hidden="true"
          onMouseDown={onClose}
        />
        <div
          className={cn("portal-drawer-panel", drawerSizes[size])}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
          <div className="portal-overlay-body">{children}</div>
          {footer ? (
            <div className="portal-overlay-footer">{footer}</div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
