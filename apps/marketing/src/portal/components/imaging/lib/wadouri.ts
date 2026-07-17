// @ts-nocheck
// Image-loader helpers for the in-browser DICOM viewer.
//
// We rely on the legacy Cornerstone (cornerstone-core) API since that's
// what's available on npm as @cornerstonejs/core@1.x. It supports the
// `wadouri:` scheme natively when @cornerstonejs/dicom-image-loader is
// registered — the loader fetches the file once, parses the header, and
// pixel-decodes into a Cornerstone Image object.

import * as cornerstone from "@cornerstonejs/core";
import * as cornerstoneWADOImageLoader from "@cornerstonejs/dicom-image-loader";

let _registered = false;

/**
 * Idempotent registration of the WADO-URI image loader. Called once at
 * viewer mount. Cornerstone's `init()` only runs once globally; subsequent
 * mounts in the same session are no-ops.
 */
export function ensureCornerstoneRegistered(): void {
  if (_registered) return;
  if (typeof window === "undefined") return;
  const { external } = cornerstone;
  if (!external.cornerstone) {
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    external.cornerstone = cornerstone;
  }
  // Tell the loader where its web-worker chunks live. With Next.js we
  // import the worker via webpack's `new Worker(new URL(...))` pattern
  // — `configure()` lets us point at the bundled URL.
  cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: Math.min(
      navigator?.hardwareConcurrency || 2,
      4
    ),
    startWebWorkersOnDemand: true,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: false,
      },
    },
  });
  _registered = true;
}

/**
 * Build a wadouri: imageId from a server-relative download URL. The
 * backend hands back `/files/download/<token>` which the viewer fetches
 * via `wadouri:https://api.healthhub.app<url>`.
 */
export function wadouriFromToken(
  token: string,
  apiBase: string = ""
): string {
  const base = apiBase || (typeof window !== "undefined" ? window.location.origin : "");
  return `wadouri:${base}/files/download/${encodeURIComponent(token)}`;
}

/**
 * Load + cache a DICOM image by wadouri: imageId. Returns the cornerstone
 * Image object. Throws on parse failure.
 */
export async function loadDicomImage(imageId: string) {
  ensureCornerstoneRegistered();
  return cornerstone.loadAndCacheImage(imageId);
}

/**
 * WADO windowing presets by modality. Applied via setViewport. Modelled on
 * the OHIF defaults; values are WW/WL in DICOM units (Hounsfield for CT).
 */
export const WINDOWING_PRESETS: Record<
  string,
  Array<{ id: string; label: string; ww: number; wl: number }>
> = {
  CT: [
    { id: "ct-soft", label: "Soft tissue", ww: 400, wl: 40 },
    { id: "ct-lung", label: "Lung", ww: 1500, wl: -600 },
    { id: "ct-bone", label: "Bone", ww: 1800, wl: 400 },
    { id: "ct-brain", label: "Brain", ww: 80, wl: 40 },
  ],
  MR: [
    { id: "mr-default", label: "Default", ww: 500, wl: 250 },
  ],
  XR: [
    { id: "xr-default", label: "Default", ww: 4095, wl: 2048 },
  ],
  US: [
    { id: "us-default", label: "Default", ww: 256, wl: 128 },
  ],
};

/**
 * Pick a default window/level preset for a modality (returns null if no
 * preset exists — caller should keep the image's natural rendering).
 */
export function defaultPreset(modality?: string | null) {
  if (!modality) return null;
  const list = WINDOWING_PRESETS[modality];
  return list?.[0] ?? null;
}
