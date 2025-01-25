import { db } from "./db";
import { properties, addresses, propertyFeatures, propertyImages, propertyValuations, listingCompanies, propertyPrices, importProgress } from "./db/schema";
import { eq } from "drizzle-orm";
import searchData from "~/scripts/search.json";

export async function processBatch(startIndex: number, batchSize: number, importId: number) {
  const endIndex = Math.min(startIndex + batchSize, searchData.length);
  const batch = searchData.slice(startIndex, endIndex);

  for (const property of batch) {
    try {
      // Insert property
      await db.insert(properties).values({
        id: property.id,
        propertyType: property.propertyType,
        propertyLink: property.propertyLink,
        description: property.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        scrapedAt: property.scraped_at ? new Date(property.scraped_at) : new Date(),
      });

      // Insert address
      await db.insert(addresses).values({
        propertyId: property.id,
        shortAddress: property.address.display.shortAddress,
        fullAddress: property.address.display.fullAddress,
        suburb: property.address.suburb,
        state: property.address.state,
        postcode: property.address.postcode,
      });

      // ... [rest of the insert operations remain the same]
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