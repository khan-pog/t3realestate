import { useEffect, useState } from 'react';

interface ImportProgress {
  currentOffset: number;
  totalItems: number;
  status: string;
  error: string | null;
}

export function ImportMonitor({ importId }: { importId: number }) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkProgress = async () => {
      try {
        // Check progress
        const progressResponse = await fetch(`/api/import-progress?importId=${importId}`);
        const progressData = await progressResponse.json();

        if (!progressData.success) {
          throw new Error(progressData.error);
        }

        setProgress(progressData.progress);

        // If status is 'in_progress', trigger next batch
        if (progressData.progress.status === 'in_progress') {
          const triggerResponse = await fetch('/api/trigger-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importId }),
          });

          if (!triggerResponse.ok) {
            throw new Error('Failed to trigger next batch');
          }
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Import monitor error:', err);
      }
    };

    // Initial check
    checkProgress();

    // Set up polling every 5 seconds
    const interval = setInterval(checkProgress, 5000);

    // Cleanup
    return () => clearInterval(interval);
  }, [importId]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!progress) {
    return <div>Loading...</div>;
  }

  const percentComplete = Math.round((progress.currentOffset / progress.totalItems) * 100);

  return (
    <div className="space-y-2">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full" 
          style={{ width: `${percentComplete}%` }}
        ></div>
      </div>
      <div className="text-sm">
        <p>Status: {progress.status}</p>
        <p>Progress: {progress.currentOffset} / {progress.totalItems} ({percentComplete}%)</p>
        {progress.error && <p className="text-red-500">Error: {progress.error}</p>}
      </div>
    </div>
  );
} 