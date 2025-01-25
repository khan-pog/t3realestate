import { useEffect, useState } from 'react';

interface ImportProgress {
  id: number;
  currentOffset: number;
  totalItems: number;
  status: string;
  error: string | null;
}

export function ImportMonitor({ importId }: { importId: number }) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resumeImport = async (id: number) => {
      try {
        const response = await fetch('/api/trigger-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importId: id }),
        });

        if (!response.ok) {
          throw new Error('Failed to resume import');
        }

        console.log('Successfully triggered next batch for import:', id);
      } catch (err) {
        console.error('Error resuming import:', err);
        setError(err instanceof Error ? err.message : 'Failed to resume import');
      }
    };

    const checkProgress = async () => {
      try {
        // Check progress
        const progressResponse = await fetch(`/api/import-progress?importId=${importId}`);
        const progressData = await progressResponse.json();

        if (!progressData.success) {
          throw new Error(progressData.error);
        }

        setProgress(progressData.progress);
        
        // If status is 'in_progress', try to resume the import
        if (progressData.progress.status === 'in_progress') {
          await resumeImport(importId);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Import monitor error:', err);
      }
    };

    // Check for incomplete imports immediately
    checkProgress();

    // Set up polling every 5 seconds
    const interval = setInterval(checkProgress, 5000);

    // Cleanup
    return () => clearInterval(interval);
  }, [importId]);

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error: {error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-4">
        <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  const percentComplete = Math.round((progress.currentOffset / progress.totalItems) * 100);

  return (
    <div className="space-y-2">
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${percentComplete}%` }}
        ></div>
      </div>
      <div className="text-sm space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-medium">Status: {progress.status}</span>
          <span className="text-gray-500">{percentComplete}%</span>
        </div>
        <p className="text-gray-600">
          Processed: {progress.currentOffset.toLocaleString()} / {progress.totalItems.toLocaleString()}
        </p>
        {progress.error && (
          <p className="text-red-500">Error: {progress.error}</p>
        )}
      </div>
    </div>
  );
} 