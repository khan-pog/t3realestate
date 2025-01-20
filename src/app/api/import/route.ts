import { NextResponse } from "next/server";
import { importData } from "~/scripts/migration-script";
import { requireAdmin } from "~/lib/auth";

export async function POST() {
  try {
    // Ensure only admins can trigger the import
    await requireAdmin();
    
    // Run the import
    await importData();
    
    return NextResponse.json({ 
      success: true,
      message: 'Import completed successfully'
    });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Import failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 