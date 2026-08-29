"use client";

import { Pin } from "lucide-react";

export function PinnedHeader({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
      <Pin size={14} />
      <span>Pinned ({count})</span>
    </div>
  );
}
