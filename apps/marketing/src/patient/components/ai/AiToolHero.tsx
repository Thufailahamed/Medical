"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
} from "@/portal/components/doctor/Workspace";

/** Ink hero for an AI sub-tool — same plate as the admin / doctor pages. */
export function AiToolHero({
  badge,
  title,
  description,
  icon,
  actions,
  trust = [],
  backHref = "/patient/ai",
  backLabel = "Back to AI tools",
}: {
  badge: string;
  title: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  trust?: string[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <DoctorHero
      overlap={false}
      kickerIcon={icon}
      kicker={badge}
      kickerMeta="AI assistant"
      title={title}
      description={description}
      chips={
        trust.length > 0 ? (
          <>
            {trust.map((item) => (
              <span key={item} className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                {item}
              </span>
            ))}
          </>
        ) : undefined
      }
      actions={
        <>
          <Link href={backHref} className={HERO_GHOST}>
            <ArrowLeft size={15} aria-hidden />
            {backLabel}
          </Link>
          {actions}
        </>
      }
    />
  );
}
