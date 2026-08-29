"use client";

const VITALS = [
  ["HbA1c", "6.1%", "in range"],
  ["BP", "122/78", "sitting"],
  ["Next dose", "20:00", "after food"],
  ["Visit", "11 Aug", "Dr. Perera"],
  ["Files", "14", "indexed"],
];

export function VitalsTape() {
  return (
    <div className="tape" aria-label="Current health values">
      <div className="tape__track">
        {[0, 1].map((copy) => (
          <div className="tape__set" key={copy} aria-hidden={copy === 1}>
            {VITALS.map(([label, value, note]) => (
              <span className="tape__item" key={`${copy}-${label}`}>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{note}</em>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PulseTrace() {
  return (
    <svg className="pulse" viewBox="0 0 640 64" role="img" aria-label="Sample pulse tracing, 72 beats per minute">
      <text x="0" y="14" className="pulse__label">Lead II · 72 bpm</text>
      <path className="pulse__grid" d="M0 32 H640" />
      <path className="pulse__wave" d="M0 32 H48 l8-2 10 18 8-38 10 28 12-6 H160 l8-2 10 18 8-38 10 28 12-6 H272 l8-2 10 18 8-38 10 28 12-6 H384 l8-2 10 18 8-38 10 28 12-6 H496 l8-2 10 18 8-38 10 28 12-6 H640" />
    </svg>
  );
}

export function AssayFigure() {
  const history = [
    { date: "Feb", value: 5.8, left: "18%" },
    { date: "Apr", value: 6.0, left: "28%" },
    { date: "Jun", value: 6.4, left: "48%" },
    { date: "Aug", value: 6.1, left: "34%" },
  ];

  return (
    <figure className="assay">
      <figcaption>
        <span>Fig. 02 · Laboratory</span>
        <span>Asiri Central · 02 Aug 2026</span>
      </figcaption>
      <div className="assay__head">
        <div>
          <small>Glycated haemoglobin</small>
          <h3>HbA1c</h3>
        </div>
        <strong>6.1<span>%</span></strong>
      </div>
      <div className="assay__range" aria-hidden="true">
        <span>4.0</span>
        <div className="assay__track">
          <i className="assay__fill" />
          <b className="assay__marker" />
        </div>
        <span>14.0</span>
      </div>
      <p className="assay__status">Just above target</p>
      <ol className="assay__history">
        {history.map((item) => (
          <li key={item.date}>
            <span>{item.date}</span>
            <div><i style={{ width: item.left }} /></div>
            <b>{item.value.toFixed(1)}</b>
          </li>
        ))}
      </ol>
      <p>Reference 4.0–5.6% · this reading sits just above target, with a quieter slope than June.</p>
    </figure>
  );
}

export function DayStrip() {
  const hours = [
    { t: "06", state: "" },
    { t: "08", state: "done", name: "D3" },
    { t: "12", state: "" },
    { t: "16", state: "" },
    { t: "20", state: "next", name: "Para" },
    { t: "22", state: "later", name: "Met" },
  ];

  return (
    <div className="daystrip" aria-label="Today's dose hours">
      <ol>
        {hours.map((hour) => (
          <li key={hour.t} className={hour.state ? `is-${hour.state}` : ""}>
            <b>{hour.t}</b>
            <i />
            <small>{hour.name ?? ""}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ContentsLedger() {
  const rows = [
    ["01", "Gather", "Snap a document, forward a result, or add a medicine. Your history starts wherever you are."],
    ["02", "Make sense", "Values are organised, trends become visible, and unfamiliar language gets a human explanation."],
    ["03", "Move forward", "Share a clean summary with your doctor, follow your routine, and spend less time looking for the past."],
  ];

  return (
    <ol className="ledger" data-reveal data-stagger>
      {rows.map(([number, title, body]) => (
        <li key={number}>
          <span>{number}</span>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
