"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, FileText, FlaskConical, Pill, Sparkles } from "lucide-react";

const EVENTS = [
  {
    id: "lab",
    day: "02",
    kind: "Laboratory",
    filter: "Lab",
    title: "HbA1c",
    value: "6.1%",
    meta: "Asiri Central · in range",
    icon: FlaskConical,
  },
  {
    id: "med",
    day: "04",
    kind: "Medicine",
    filter: "Med",
    title: "Paracetamol 500mg",
    value: "20:00",
    meta: "Tonight · after food",
    icon: Pill,
  },
  {
    id: "visit",
    day: "11",
    kind: "Appointment",
    filter: "Visit",
    title: "Dr. N. Perera",
    value: "09:30",
    meta: "Nawaloka · follow-up",
    icon: Calendar,
  },
  {
    id: "file",
    day: "28",
    kind: "Document",
    filter: "File",
    title: "Discharge summary",
    value: "PDF",
    meta: "4 pages · indexed",
    icon: FileText,
  },
  {
    id: "insight",
    day: "·",
    kind: "Insight",
    filter: "All",
    title: "Pattern across 3 labs",
    value: "+0.3",
    meta: "Health AI · discuss with GP",
    icon: Sparkles,
  },
] as const;

const FILTERS = ["All", "Lab", "Med", "Visit", "File"] as const;
const SPARK = [5.78, 5.92, 6.08, 6.36, 6.22, 6.1];

export function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.18;
  const lo = min - pad;
  const hi = max + pad;
  const width = 112;
  const height = 32;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - lo) / (hi - lo)) * height;
    return { x, y };
  });
  const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg className="living__spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} className="living__spark-fill" />
      <path d={d} className="living__spark-line" />
      <circle cx={last.x} cy={last.y} r="2.6" className="living__spark-now" />
    </svg>
  );
}

export function LivingTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const reactId = useId();
  const visible = EVENTS.filter((event) => filter === "All" || event.filter === filter || event.filter === "All");

  useEffect(() => {
    setActive(0);
  }, [filter]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;

    let frame = 0;
    const nodes = () => rowRefs.current.filter((node): node is HTMLLIElement => Boolean(node));

    const paint = (clientX: number, clientY: number) => {
      const bounds = root.getBoundingClientRect();
      root.style.setProperty("--cursor-x", `${clientX - bounds.left}px`);
      root.style.setProperty("--cursor-y", `${clientY - bounds.top}px`);

      let nearest = 0;
      let nearestDistance = Infinity;

      nodes().forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width * 0.35);
        const dy = clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / 240);
        node.style.setProperty("--pull-x", `${dx * influence * 0.045}px`);
        node.style.setProperty("--pull-y", `${dy * influence * 0.05}px`);
        node.style.setProperty("--near", influence.toFixed(3));
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });

      setActive((current) => (current === nearest ? current : nearest));
      frame = 0;
    };

    const onMove = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(() => paint(x, y));
    };

    const onLeave = () => {
      root.style.setProperty("--cursor-x", "72%");
      root.style.setProperty("--cursor-y", "42%");
      nodes().forEach((node) => {
        node.style.setProperty("--pull-x", "0px");
        node.style.setProperty("--pull-y", "0px");
        node.style.setProperty("--near", "0");
      });
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [filter]);

  return (
    <div ref={rootRef} className="living" aria-label="Sample HealthHub living health timeline">
      <div className="living__sheet" aria-hidden="true" />
      <div className="living__sheet living__sheet--back" aria-hidden="true" />

      <article className="living__panel">
        <header className="living__head">
          <span>Fig. 01 · Living record</span>
          <span className="living__live"><i /> Live index</span>
        </header>

        <div className="living__meta">
          <span>Patient 01</span>
          <span>Aug 2026</span>
          <span>Encrypted field</span>
        </div>

        <div className="living__filters" role="tablist" aria-label="Filter record types">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              className={filter === item ? "is-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <ol className="living__list">
          {visible.map((event, index) => {
            const Icon = event.icon;
            const selected = active === index;
            return (
              <li
                key={event.id}
                ref={(node) => { rowRefs.current[index] = node; }}
                className={`living__row ${selected ? "is-active" : ""}`}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <button type="button" className="living__hit" aria-pressed={selected} aria-describedby={`${reactId}-${event.id}`}>
                  <span className="living__day">{event.day}</span>
                  <span className="living__node" aria-hidden="true" />
                  <span className="living__card">
                    <span className="living__kind"><Icon size={12} strokeWidth={1.75} />{event.kind}</span>
                    <strong>{event.title}</strong>
                    <em id={`${reactId}-${event.id}`}>{event.meta}</em>
                    {event.id === "lab" && <Sparkline values={SPARK} />}
                  </span>
                  <b className="living__value">{event.value}</b>
                </button>
              </li>
            );
          })}
        </ol>

        <footer className="living__foot">
          <span>{visible.length} entries</span>
          <i />
          <span>Search by date, doctor, or condition</span>
        </footer>
      </article>

      <aside className="living__float living__float--lab" aria-hidden="true">
        <span>Last panel</span>
        <strong>Glucose trend</strong>
        <Sparkline values={[92, 96, 101, 98, 104, 99]} />
        <small>Fasting · 99 mg/dL</small>
      </aside>

      <aside className="living__float living__float--dose" aria-hidden="true">
        <span>Next dose</span>
        <strong>20:00</strong>
        <small>Paracetamol · after food</small>
      </aside>

      <div className="living__cursor" aria-hidden="true" />
      <div className="living__marks" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
