export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded bg-charcoal/10" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-charcoal/10" />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
