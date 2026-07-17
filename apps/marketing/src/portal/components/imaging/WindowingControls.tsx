"use client";

// Window/Level controls for the DICOM viewer. Stateless: parent owns the
// actual viewport mutation; we just emit (ww, wl) onChange events.

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/portal/i18n";
import { WINDOWING_PRESETS } from "./lib/wadouri";
import { Button } from "@/portal/components/ui/Button";

export function WindowingControls({
  modality,
  initialWW,
  initialWL,
  onChange,
}: {
  modality: string;
  initialWW?: number | null;
  initialWL?: number | null;
  onChange: (ww: number, wl: number) => void;
}) {
  const t = useT();
  const presets = useMemo(() => WINDOWING_PRESETS[modality] ?? [], [modality]);
  const [ww, setWW] = useState<number | null>(initialWW ?? null);
  const [wl, setWL] = useState<number | null>(initialWL ?? null);

  useEffect(() => {
    setWW(initialWW ?? null);
    setWL(initialWL ?? null);
  }, [initialWW, initialWL, modality]);

  const apply = (newWW: number, newWL: number) => {
    setWW(newWW);
    setWL(newWL);
    onChange(newWW, newWL);
  };

  if (presets.length === 0 && ww == null && wl == null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.id}
              variant="ghost"
              size="sm"
              onClick={() => apply(p.ww, p.wl)}
            >
              {t(`imaging.presets.${p.id.split("-").slice(-1)[0]}`, p.label)}
            </Button>
          ))}
        </div>
      )}
      {ww != null && wl != null && (
        <div className="grid grid-cols-2 gap-3 text-[11px] text-text-muted">
          <label className="flex items-center gap-2">
            <span className="w-12 shrink-0">{t("imaging.width")}</span>
            <input
              type="range"
              min={1}
              max={Math.max(ww * 4, 1000)}
              value={ww}
              onChange={(e) => apply(Number(e.target.value), wl)}
              className="flex-1"
            />
            <span className="w-12 text-right tabular-nums">{Math.round(ww)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12 shrink-0">{t("imaging.level")}</span>
            <input
              type="range"
              min={Math.min(wl - 1000, -1000)}
              max={Math.max(wl + 1000, 1000)}
              value={wl}
              onChange={(e) => apply(ww, Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-right tabular-nums">{Math.round(wl)}</span>
          </label>
        </div>
      )}
    </div>
  );
}
