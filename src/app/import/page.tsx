'use client';

import { useState } from 'react';
import { ImportMonitor } from '~/components/ImportMonitor';

export default function ImportPage() {
  const [importId, setImportId] = useState<number | null>(null);

  const startImport = async () => {
    try {
      const response = await fetch('/api/import-data', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setImportId(data.importId);
      } else {
        console.error('Failed to start import:', data.error);
      }
    } catch (error) {
      console.error('Error starting import:', error);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Data Import</h1>
      
      {!importId ? (
        <button
          onClick={startImport}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Start Import
        </button>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl">Import Progress</h2>
          <ImportMonitor importId={importId} />
        </div>
      )}
    </div>
  );
} 