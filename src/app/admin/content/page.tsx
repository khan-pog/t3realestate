import { ImportDataButton } from "~/components/admin/ImportDataButton";

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Content Management</h1>
      
      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-semibold mb-4">Data Import</h2>
        <p className="text-gray-600 mb-4">
          Import property data from search.json into the database. 
          This will update existing properties and add new ones.
        </p>
        <ImportDataButton />
      </div>
    </div>
  );
} 