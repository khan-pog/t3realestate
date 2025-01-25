import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { properties, addresses, propertyFeatures, propertyImages, propertyValuations, listingCompanies, propertyPrices, importProgress } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import searchData from "~/scripts/search.json";

const BATCH_SIZE = 10; // Keep in sync with import-data/route.ts

// Re-use the processBatch function from import-data/route.ts
// In a real application, this should be moved to a shared utility file
async function processBatch(startIndex: number, batchSize: number, importId: number) {
  const endIndex = Math.min(startIndex + batchSize, searchData.length);
  const batch = searchData.slice(startIndex, endIndex);

  for (const property of batch) {
    try {
      // Insert or update property
      await db.insert(properties).values({
        id: property.id,
        propertyType: property.propertyType,
        propertyLink: property.propertyLink,
        description: property.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        scrapedAt: property.scraped_at ? new Date(property.scraped_at) : new Date(),
      })
      .onConflictDoUpdate({
        target: properties.id,
        set: {
          propertyType: property.propertyType,
          propertyLink: property.propertyLink,
          description: property.description,
          updatedAt: new Date(),
          scrapedAt: property.scraped_at ? new Date(property.scraped_at) : new Date(),
        }
      });

      // Update or insert address
      await db.insert(addresses).values({
        propertyId: property.id,
        shortAddress: property.address.display.shortAddress || null,
        fullAddress: property.address.display.fullAddress || null,
        suburb: property.address.suburb || null,
        state: property.address.state || null,
        postcode: property.address.postcode || null,
      })
      .onConflictDoUpdate({
        target: [addresses.propertyId],
        set: {
          shortAddress: property.address.display.shortAddress || null,
          fullAddress: property.address.display.fullAddress || null,
          suburb: property.address.suburb || null,
          state: property.address.state || null,
          postcode: property.address.postcode || null,
        }
      });

      // Update or insert features
      await db.insert(propertyFeatures).values({
        propertyId: property.id,
        bedrooms: property.generalFeatures?.bedrooms?.value ?? null,
        bathrooms: property.generalFeatures?.bathrooms?.value ?? null,
        parkingSpaces: property.generalFeatures?.parkingSpaces?.value ?? null,
        landSize: property.propertySizes?.land?.displayValue ? parseFloat(property.propertySizes.land.displayValue) : null,
        landUnit: property.propertySizes?.land?.sizeUnit?.displayValue || null,
        buildingSize: property.propertySizes?.building?.displayValue ? parseFloat(property.propertySizes.building.displayValue) : null,
        buildingUnit: property.propertySizes?.building?.sizeUnit?.displayValue || null,
      })
      .onConflictDoUpdate({
        target: [propertyFeatures.propertyId],
        set: {
          bedrooms: property.generalFeatures?.bedrooms?.value ?? null,
          bathrooms: property.generalFeatures?.bathrooms?.value ?? null,
          parkingSpaces: property.generalFeatures?.parkingSpaces?.value ?? null,
          landSize: property.propertySizes?.land?.displayValue ? parseFloat(property.propertySizes.land.displayValue) : null,
          landUnit: property.propertySizes?.land?.sizeUnit?.displayValue || null,
          buildingSize: property.propertySizes?.building?.displayValue ? parseFloat(property.propertySizes.building.displayValue) : null,
          buildingUnit: property.propertySizes?.building?.sizeUnit?.displayValue || null,
        }
      });

      // For images, delete existing ones and insert new ones
      if (property.images && property.images.length > 0) {
        await db.delete(propertyImages).where(eq(propertyImages.propertyId, property.id));
        await Promise.all(
          property.images.map((url, index) =>
            db.insert(propertyImages).values({
              propertyId: property.id,
              url: url.replace("{size}", "800x600"),
              order: index,
            })
          )
        );
      }

      // Insert or update valuations
      if (property.valuationData) {
        await db.insert(propertyValuations).values({
          propertyId: property.id,
          source: property.valuationData.source,
          confidence: property.valuationData.confidence || null,
          estimatedValue: property.valuationData.estimatedValue || null,
          priceRange: property.valuationData.priceRange || null,
          lastUpdated: new Date(),
          rentalValue: property.valuationData.rental?.value || null,
          rentalPeriod: property.valuationData.rental?.period || null,
          rentalConfidence: property.valuationData.rental?.confidence || null,
        })
        .onConflictDoUpdate({
          target: [propertyValuations.propertyId],
          set: {
            source: property.valuationData.source,
            confidence: property.valuationData.confidence || null,
            estimatedValue: property.valuationData.estimatedValue || null,
            priceRange: property.valuationData.priceRange || null,
            lastUpdated: new Date(),
            rentalValue: property.valuationData.rental?.value || null,
            rentalPeriod: property.valuationData.rental?.period || null,
            rentalConfidence: property.valuationData.rental?.confidence || null,
          }
        });
      }

      // Update or insert prices
      if (property.price || property.priceDetails) {
        await db.insert(propertyPrices).values({
          propertyId: property.id,
          displayPrice: property.price?.display || null,
          priceFrom: property.priceDetails?.from || null,
          priceTo: property.priceDetails?.to || null,
          searchRange: property.price?.searchRange || null,
          priceInformation: property.price?.information || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [propertyPrices.propertyId],
          set: {
            displayPrice: property.price?.display || null,
            priceFrom: property.priceDetails?.from || null,
            priceTo: property.priceDetails?.to || null,
            searchRange: property.price?.searchRange || null,
            priceInformation: property.price?.information || null,
            updatedAt: new Date(),
          }
        });
      }
    } catch (error) {
      console.error(`Error processing property ${property.id}:`, error);
      throw error;
    }
  }

  // Update progress
  await db.update(importProgress)
    .set({ 
      currentOffset: endIndex,
      updatedAt: new Date(),
      status: endIndex >= searchData.length ? 'completed' : 'in_progress'
    })
    .where(eq(importProgress.id, importId));

  return endIndex >= searchData.length;
}

export async function POST(request: Request) {
  try {
    // Check if this is an initial import or a continuation
    const body = await request.json();
    
    console.log('Trigger import called with body:', body);

    if (!body.importId) {
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

      console.log('Processing batch starting at offset:', importRecord?.currentOffset);

      // If not complete, trigger next batch via API
      if (!isComplete) {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const nextBatchUrl = `${baseUrl}/api/trigger-import`;
        
        const response = await fetch(nextBatchUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': process.env.API_SECRET_KEY || ''
          },
          body: JSON.stringify({ importId: importRecord.id }),
        });

        if (!response.ok) {
          console.error('Failed to trigger next batch:', await response.text());
          throw new Error(`Failed to trigger next batch: ${response.status}`);
        }
      }

      console.log('Batch processed, isComplete:', isComplete);

      return NextResponse.json({ 
        success: true, 
        message: 'Import process started',
        importId: importRecord.id
      });
    } else {
      // Continue existing import
      const { importId } = body;

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

      console.log('Processing batch starting at offset:', currentImport?.currentOffset);

      // If not complete, trigger next batch
      if (!isComplete) {
        try {
          // Wait a short delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          const nextBatchUrl = `${baseUrl}/api/trigger-import`;
          
          const response = await fetch(nextBatchUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': process.env.API_SECRET_KEY || ''
            },
            body: JSON.stringify({ importId }),
          });

          if (!response.ok) {
            console.error('Failed to trigger next batch:', await response.text());
            throw new Error(`Failed to trigger next batch: ${response.status}`);
          }
        } catch (error) {
          console.error('Error triggering next batch:', error);
          // Update import status to failed
          await db.update(importProgress)
            .set({ 
              status: 'failed',
              error: 'Failed to trigger next batch',
              updatedAt: new Date()
            })
            .where(eq(importProgress.id, importId));
          throw error;
        }
      }

      console.log('Batch processed, isComplete:', isComplete);

      return NextResponse.json({ 
        success: true,
        message: isComplete ? "Import completed" : "Next batch triggered",
        importId
      });
    }
  } catch (error) {
    console.error("Error processing batch:", error);
    
    // Update import status to failed
    try {
      const body = await request.json();
      if (body.importId) {
        await db.update(importProgress)
          .set({ 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date()
          })
          .where(eq(importProgress.id, body.importId));
      }
    } catch {
      // Ignore error if we can't parse the body
    }

    return NextResponse.json(
      { success: false, error: "Failed to process batch" },
      { status: 500 }
    );
  }
} 