"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHero } from "@/patient/components/primitives/PageHero";

export function AiToolHero({
  badge,
  title,
  description,
  icon,
  actions,
  trust = [],
  backHref = "/patient/ai",
  backLabel = "Back to AI tools",
  className,
}: {
  badge: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  trust?: string[];
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-[11.5px] font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ArrowLeft size={12} aria-hidden />
        {backLabel}
      </Link>

      <PageHero
        icon={icon}
        kicker={badge}
        title={title}
        description={description}
        actions={actions}
        footer={
          trust.length > 0 ? (
            <>
              {trust.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </>
          ) : undefined
        }
        className={className}
      />
    </div>
  );
}
