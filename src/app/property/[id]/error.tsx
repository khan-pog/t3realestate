'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center px-4">
      <h2 className="mb-4 text-2xl font-bold text-red-600">
        Failed to load property
      </h2>
      <p className="mb-6 text-center text-gray-600">{error.message}</p>
      <div className="flex gap-4">
        <button
          onClick={() => window.history.back()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
        >
          Go back
        </button>
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
} 