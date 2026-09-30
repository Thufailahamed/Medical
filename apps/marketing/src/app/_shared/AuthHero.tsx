import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";

export interface AuthHeroCard {
  initials: ReactNode;
  title: string;
  subtitle: string;
  chip: string;
  stats: { label: string; value: string }[];
}

export interface AuthHeroProps {
  /** Re-keys the animated blocks so they replay when the content swaps. */
  animKey?: string;
  kicker: string;
  headline: string;
  highlight: string;
  lede: string;
  photo: string;
  float?: { icon: ReactNode; title: string; caption: string };
  card: AuthHeroCard;
}

/** Dark left-hand hero shared by /login and /patient/register (desktop only). */
export function AuthHero({
  animKey,
  kicker,
  headline,
  highlight,
  lede,
  photo,
  float,
  card,
}: AuthHeroProps) {
  return (
    <aside className="au-hero" aria-label="HealthHub">
      <div className="au-hero__top">
        <Link href="/" className="au-brand">
          <span className="au-brand__mark">
            <img src="/assets/logo.svg" alt="" width={22} height={22} />
          </span>
          <span className="au-brand__name">
            HealthHub<span className="au-brand__beta">Beta</span>
          </span>
        </Link>
        <div className="au-langs" aria-label="Available in">
          <span>EN</span>
          <span>සිංහල</span>
          <span>தமிழ்</span>
        </div>
      </div>

      <div className="au-hero__copy" key={`copy-${animKey}`}>
        <span className="au-kicker">
          <i />
          {kicker}
        </span>
        <h2 className="au-headline">
          {headline}
          <em>{highlight}</em>
        </h2>
        <p className="au-lede">{lede}</p>
      </div>

      <div className="au-stage" aria-hidden="true">
        <div className="au-stage__photo">
          <img src={photo} alt="" key={photo} />
          {float && (
            <div className="au-float" key={`float-${animKey}`}>
              <span className="au-float__icon">{float.icon}</span>
              <span>
                {float.title}
                <small>{float.caption}</small>
              </span>
            </div>
          )}
        </div>

        <div className="au-card" key={`card-${animKey}`}>
          <div className="au-card__head">
            <div className="au-card__who">
              <span className="au-card__avatar">{card.initials}</span>
              <div style={{ minWidth: 0 }}>
                <div className="au-card__title">{card.title}</div>
                <div className="au-card__sub">{card.subtitle}</div>
              </div>
            </div>
            <span className="au-card__chip">{card.chip}</span>
          </div>
          <div className="au-card__stats">
            {card.stats.map((s) => (
              <div key={s.label}>
                <span>{s.label}</span>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="au-hero__foot">
        <div className="au-hero__trust">
          <span>
            <ShieldCheck size={13} />
            256-bit encrypted
          </span>
          <span>
            <Lock size={13} />
            Never sold
          </span>
        </div>
        <span>© {new Date().getFullYear()} HealthHub</span>
      </div>
    </aside>
  );
}
