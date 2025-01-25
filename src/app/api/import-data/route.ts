import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { importProgress } from "~/server/db/schema";
import searchData from "~/scripts/search.json";
import { processBatch } from "~/server/import-utils";

const BATCH_SIZE = 10; // Adjust based on your needs

export async function POST() {
  try {
    // Start new import process
    const [importRecord] = await db.insert(importProgress)
      .values({
        batchSize: BATCH_SIZE,
        currentOffset: 0,
        totalItems: searchData.length,
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Process first batch
    const isComplete = await processBatch(0, BATCH_SIZE, importRecord.id);

    // If not complete, trigger next batch via API
    if (!isComplete) {
      const nextBatchUrl = new URL('/api/trigger-import', 'https://' + process.env.VERCEL_URL).toString();
      await fetch(nextBatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: importRecord.id }),
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Import process started',
      importId: importRecord.id
    });
  } catch (error) {
    console.error("Error starting import:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start import" },
      { status: 500 }
    );
  }
} 