"use client";

export default function TabStub({
  title,
  phaseNote,
}: {
  title: string;
  phaseNote?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <div className="text-sm font-medium text-text">{title}</div>
      {phaseNote ? (
        <div className="text-xs text-text-muted mt-1">{phaseNote}</div>
      ) : null}
    </div>
  );
}