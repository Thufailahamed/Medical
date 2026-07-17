"use client";

// In-browser DICOM viewer.
//
// Tier 1 MVP shell: Renders the chrome (toolbar, prev/next carousel,
// modality pill, windowing controls) and provides a download link per
// instance. The actual in-browser WebGL render is delegated to a
// follow-up: cornerstone v5 (the @cornerstonejs/core rebrand) uses a
// RenderingEngine + StackViewport pipeline that is materially different
// from the v1.x `cornerstone.enable()` / `displayImage()` API this code
// originally targeted. Wired up here as a "view & download" surface so
// the underlying API contracts and RBAC are exercisable end-to-end
// before we commit to the v5 viewport wiring.
//
// Public surface:
//   <DicomViewer instances={[{ viewerUrl, modality? }]} />

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
} from "lucide-react";

import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { useT } from "@/portal/i18n";

export type ImagingInstance = {
  viewerUrl: string; // /files/download/<token>
  fileName?: string | null;
  modality?: string | null;
};

const WindowingControls = dynamic(
  () => import("./WindowingControls").then((m) => m.WindowingControls),
  { ssr: false }
);

export function DicomViewer({
  instances,
  initialIndex = 0,
}: {
  instances: ImagingInstance[];
  initialIndex?: number;
}) {
  const t = useT();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(instances.length - 1, 0))
  );
  const [ww, setWw] = useState<number | undefined>(undefined);
  const [wl, setWl] = useState<number | undefined>(undefined);
  // If a future build wires up the v5 RenderingEngine, that effect
  // will live here — for now the viewer is the download surface.
  const _renderEffectRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    return () => {
      _renderEffectRef.current?.();
    };
  }, []);

  const current = instances[index];

  // Mirror displayed instance into metadata fields the toolbar reads.
  useEffect(() => {
    if (!current?.modality) return;
    // Windowing presets per modality — the future render path will
    // pipe these into `viewport.setProperties({ voi: … })`. Until
    // then we surface them in the controls panel so the operator
    // can reason about expected values.
    if (current.modality === "CT") {
      setWw(400);
      setWl(40);
    } else if (current.modality === "MR") {
      setWw(800);
      setWl(400);
    } else {
      setWw(undefined);
      setWl(undefined);
    }
  }, [current?.modality, current?.viewerUrl]);

  const handlePrev = () => {
    setIndex((i) => (i > 0 ? i - 1 : instances.length - 1));
  };
  const handleNext = () => {
    setIndex((i) => (i < instances.length - 1 ? i + 1 : 0));
  };

  const handleWindowChange = (newWw: number, newWl: number) => {
    setWw(newWw);
    setWl(newWl);
  };

  const handleDownload = () => {
    if (!current?.viewerUrl) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    window.open(`${base}${current.viewerUrl}`, "_blank");
  };

  const instanceCount = instances.length;
  const showCarousel = instanceCount > 1;

  return (
    <Card padding={false} className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-surface/40">
        <div className="flex items-center gap-2 min-w-0">
          {current?.modality && <Pill tone="info">{current.modality}</Pill>}
          {ww && wl && (
            <span className="text-[11px] text-text-muted tabular-nums">
              WW {ww} / WL {wl}
            </span>
          )}
          {current?.fileName && (
            <span className="text-[11px] text-text-muted truncate max-w-[200px]">
              {current.fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {showCarousel && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                aria-label={t("imaging.prevFrame")}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[11px] text-text-muted tabular-nums">
                {index + 1} / {instanceCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                aria-label={t("imaging.nextFrame")}
              >
                <ChevronRight size={14} />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            aria-label={t("imaging.download")}
          >
            <Download size={14} />
          </Button>
        </div>
      </div>

      {/* Placeholder canvas — actual WebGL render pending v5
          RenderingEngine integration. */}
      <div className="relative bg-black aspect-[4/3] sm:aspect-[16/10]">
        <button
          type="button"
          onClick={handleDownload}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted hover:text-text transition-colors"
        >
          <ImageIcon size={36} className="opacity-50" />
          <span className="text-xs">{t("imaging.downloadOriginal")}</span>
        </button>
      </div>

      {/* Windowing controls */}
      {current?.modality && (
        <div className="px-3 py-2 border-t border-border/50">
          <WindowingControls
            modality={current.modality}
            initialWW={ww}
            initialWL={wl}
            onChange={handleWindowChange}
          />
        </div>
      )}
    </Card>
  );
}

// Convenience default export for `dynamic({ loader: () => import('./DicomViewer') })`.
export default DicomViewer;