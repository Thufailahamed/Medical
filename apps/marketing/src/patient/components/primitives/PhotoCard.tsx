"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/portal/lib/utils";
import { Card } from "./Card";

export function PhotoCard({
  imageSrc,
  fallbackInitials,
  alt,
  badge,
  title,
  meta,
  footer,
  href,
  className,
}: {
  imageSrc?: string | null;
  fallbackInitials: string;
  alt: string;
  badge?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(imageSrc) && !errored;

  const body = (
    <Card padded={false} className={cn("pt-photo-zoom overflow-hidden", className)}>
      <div className="relative h-36 overflow-hidden bg-surface-2">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc as string}
            alt={alt}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="pt-photo-fallback grid h-full w-full place-items-center text-xl font-bold">
            {fallbackInitials}
          </div>
        )}
        <div aria-hidden className="pt-photo-overlay pointer-events-none absolute inset-0" />
        {badge ? <div className="absolute left-2.5 top-2.5">{badge}</div> : null}
      </div>
      <div className="space-y-2 p-4">
        <div className="t-card-title text-text">{title}</div>
        {meta ? <div className="t-micro">{meta}</div> : null}
        {footer ? <div className="border-t border-ink/10 pt-3">{footer}</div> : null}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} aria-label={typeof title === "string" ? title : alt} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
