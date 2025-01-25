'use client';

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

interface ImportProgress {
  currentOffset: number;
  totalItems: number;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export function ImportDataButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [importId, setImportId] = useState<number | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for progress updates
  useEffect(() => {
    if (!importId || !isLoading) return;

    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/import-progress?importId=${importId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check progress');
        }

        setProgress(data.progress);

        if (data.progress.status === 'completed' || data.progress.status === 'failed') {
          setIsLoading(false);
          if (data.progress.status === 'failed') {
            setError(data.progress.error || 'Import failed');
          }
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to check progress');
        setIsLoading(false);
      }
    };

    const interval = setInterval(checkProgress, 2000);
    return () => clearInterval(interval);
  }, [importId, isLoading]);

  const handleImport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setProgress(null);

      const response = await fetch('/api/import-data', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportId(data.importId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed');
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) {
      if (progress) {
        const percent = Math.round((progress.currentOffset / progress.totalItems) * 100);
        return `Importing... ${percent}%`;
      }
      return 'Starting import...';
    }
    return 'Import Property Data';
  };

  return (
    <div className="space-y-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant={error ? 'destructive' : 'default'}
            disabled={isLoading}
          >
            {getButtonText()}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Property Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will import all property data from search.json into the database. 
              The import will be processed in batches to handle the data volume.
              You can monitor the progress here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
      
      {progress && progress.status === 'completed' && (
        <p className="text-sm text-green-600">
          Import completed successfully!
        </p>
      )}
    </div>
  );
} 