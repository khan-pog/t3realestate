export default function Loading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 h-10 w-2/3 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-6 w-1/2 animate-pulse rounded-lg bg-gray-200" />
      </div>

      <div className="mb-8 h-[400px] animate-pulse rounded-lg bg-gray-200" />

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1 h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="mb-4">
              <div className="mb-1 h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="mb-4">
                <div className="mb-1 h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 