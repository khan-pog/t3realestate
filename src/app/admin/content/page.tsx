'use client';
import { useState } from 'react';
import { ImportDataButton } from "~/components/admin/ImportDataButton";

export default function ContentPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const handleImport = async () => {
    setIsImporting(true);
    setProgress('Starting import...');
    
    try {
      // Start the import
      let response = await fetch('/api/trigger-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      let data = await response.json();
      
      // Continue processing batches until complete
      while (!data.isComplete) {
        setProgress(`Processing batch... Import ID: ${data.importId}`);
        
        // Add a small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        response = await fetch('/api/trigger-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importId: data.importId }),
        });
        
        data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error);
        }
      }
      
      setProgress('Import completed successfully!');
    } catch (error) {
      setProgress(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Content Management</h1>
      
      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-semibold mb-4">Data Import</h2>
        <p className="text-gray-600 mb-4">
          Import property data from search.json into the database. 
          This will update existing properties and add new ones.
        </p>
        <div className="space-y-4">
          <ImportDataButton 
            onClick={handleImport} 
            disabled={isImporting}
          />
          {progress && (
            <div className={`text-sm ${isImporting ? 'text-blue-600' : 'text-green-600'}`}>
              {progress}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 