"use client";

import { useState } from "react";
import { usePresignAttachment } from "@/patient/hooks";

/**
 * Secure document preview.
 * - Uses short-lived single-use presigned URLs (POST /files/presign).
 * - Never persists storage URLs; preview URL lives only in component state.
 * - Images render inline; PDFs render in an iframe; other types show metadata + download.
 */
export function DocumentPreview({
  fileId,
  fileName,
  mimeType,
}: {
  fileId: string;
  fileName: string;
  mimeType?: string | null;
}) {
  const presign = usePresignAttachment();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    try {
      const res = (await presign.mutateAsync({ fileId })) as { url: string };
      setUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  function close() {
    setUrl(null);
  }

  const isPdf = (mimeType || "").includes("pdf");
  const isImage = (mimeType || "").startsWith("image/");

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={open}
        disabled={presign.isPending}
        className="rounded-inner border border-border bg-surface-1 px-2 py-1 text-xs hover:bg-surface-3 disabled:opacity-50"
      >
        {presign.isPending ? "Loading…" : "Preview"}
      </button>
      {error ? <span className="t-micro text-red-600">{error}</span> : null}
      {url ? (
        <div
          role="dialog"
          aria-label={`Preview ${fileName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-2 rounded-lg bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <button
                type="button"
                onClick={close}
                className="rounded border px-2 py-1 text-xs hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={fileName}
                className="max-h-[75vh] w-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : isPdf ? (
              <iframe
                src={url}
                title={fileName}
                className="h-[75vh] w-full rounded border"
              />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-600">
                  Preview not available for {mimeType || "this file type"}. Use
                  download to view it securely.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  Open securely
                </a>
              </div>
            )}
            <p className="t-micro text-gray-500">
              Secure temporary link — expires in ~5 minutes and cannot be reused.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
