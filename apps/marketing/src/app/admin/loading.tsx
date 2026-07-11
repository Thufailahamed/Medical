export default function AdminLoading() {
  return (
    <div className="min-h-screen grid place-items-center text-text-soft text-sm">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 bg-amber-600 rounded-full animate-pulse" />
        <div className="h-2 w-2 bg-amber-600 rounded-full animate-pulse [animation-delay:200ms]" />
        <div className="h-2 w-2 bg-amber-600 rounded-full animate-pulse [animation-delay:400ms]" />
        <span>Loading admin…</span>
      </div>
    </div>
  );
}