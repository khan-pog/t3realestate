'use client';

import { useState } from "react";
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

export function ImportDataButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    try {
      setIsLoading(true);
      setStatus('idle');
      setMessage('');

      const response = await fetch('/api/import', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || 'Import failed');
      }

      setStatus('success');
      setMessage(data.message || 'Import completed successfully');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={status === 'error' ? 'destructive' : 'default'}>
            Import Property Data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Property Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will import all property data from search.json into the database. 
              Existing properties will be updated if changed. This operation cannot be undone.
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
      
      {message && (
        <p className={`text-sm ${
          status === 'success' ? 'text-green-600' : 'text-red-600'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
} 