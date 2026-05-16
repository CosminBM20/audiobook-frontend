// Shown while app/page.tsx (Server Component) fetches books.
// Header and sidebar are already visible via ConditionalLayout (client component).
export default function Loading() {
  return (
    <div className="p-8">
      {/* Page header skeleton */}
      <div className="mb-6 space-y-1.5">
        <div className="h-7 w-36 bg-muted rounded animate-pulse" />
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
      </div>

      {/* Category pills skeleton */}
      <div className="flex gap-2 mb-8">
        {[60, 44, 72, 56, 48].map(w => (
          <div key={w} className="h-7 bg-muted rounded-full animate-pulse" style={{ width: w }} />
        ))}
      </div>

      {/* Book grid skeleton — matches xl:grid-cols-5 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border overflow-hidden animate-pulse">
            <div className="aspect-[2/3] bg-muted" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/3 mt-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
