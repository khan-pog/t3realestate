export default function Loading() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 h-10 w-48 animate-pulse rounded-lg bg-gray-200" />
      <div className="flex flex-wrap justify-center gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex w-full flex-col overflow-hidden rounded-lg bg-white shadow-md sm:w-[300px]"
          >
            <div className="h-48 w-full animate-pulse bg-gray-200" />
            <div className="p-4">
              <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="mb-2 flex gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-4 w-16 animate-pulse rounded bg-gray-200"
                  />
                ))}
              </div>
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 