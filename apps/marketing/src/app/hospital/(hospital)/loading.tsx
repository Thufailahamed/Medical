import { Card } from "@/portal/components/ui/Card";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-1/3 animate-pulse rounded bg-surface" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="h-6 w-1/2 animate-pulse rounded bg-surface" />
            <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-surface" />
          </Card>
        ))}
      </div>
    </div>
  );
}