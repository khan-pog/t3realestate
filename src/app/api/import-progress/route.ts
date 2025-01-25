import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { importProgress } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');

    if (!importId) {
      return NextResponse.json(
        { success: false, error: "Import ID is required" },
        { status: 400 }
      );
    }

    const progress = await db.query.importProgress.findFirst({
      where: eq(importProgress.id, parseInt(importId)),
    });

    if (!progress) {
      return NextResponse.json(
        { success: false, error: "Import not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: {
        currentOffset: progress.currentOffset,
        totalItems: progress.totalItems,
        status: progress.status,
        error: progress.error,
      },
    });
  } catch (error) {
    console.error("Error checking import progress:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check import progress" },
      { status: 500 }
    );
  }
} 