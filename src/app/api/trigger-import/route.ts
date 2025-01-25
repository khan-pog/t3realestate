import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { importProgress } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { processBatch } from "~/server/import-utils";

const BATCH_SIZE = 10; // Keep in sync with import-data/route.ts

export async function POST(request: Request) {
  try {
    const { importId } = await request.json();

    // Get current import progress
    const currentImport = await db.query.importProgress.findFirst({
      where: eq(importProgress.id, importId),
    });

    if (!currentImport) {
      return NextResponse.json(
        { success: false, error: "Import not found" },
        { status: 404 }
      );
    }

    if (currentImport.status === 'completed') {
      return NextResponse.json({ 
        success: true,
        message: "Import already completed"
      });
    }

    if (currentImport.status === 'failed') {
      return NextResponse.json(
        { success: false, error: "Import previously failed" },
        { status: 400 }
      );
    }

    // Process next batch
    const isComplete = await processBatch(
      currentImport.currentOffset,
      currentImport.batchSize,
      currentImport.id
    );

    // If not complete, trigger next batch
    if (!isComplete) {
      // Wait a short delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const nextBatchUrl = new URL('/api/trigger-import', 'https://' + process.env.VERCEL_URL).toString();
      await fetch(nextBatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId }),
      });
    }

    return NextResponse.json({ 
      success: true,
      message: isComplete ? "Import completed" : "Next batch triggered",
      importId
    });
  } catch (error) {
    console.error("Error processing batch:", error);
    
    // Update import status to failed
    if (request.body) {
      const { importId } = await request.json();
      await db.update(importProgress)
        .set({ 
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(importProgress.id, importId));
    }

    return NextResponse.json(
      { success: false, error: "Failed to process batch" },
      { status: 500 }
    );
  }
} 