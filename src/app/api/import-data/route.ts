import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { properties, addresses, propertyFeatures, propertyImages, propertyValuations, listingCompanies, propertyPrices, importProgress } from "~/server/db/schema";
import searchData from "~/scripts/search.json";
import { eq } from "drizzle-orm";

const BATCH_SIZE = 10; // Adjust based on your needs

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
        shortAddress: property.address.display.shortAddress,
        fullAddress: property.address.display.fullAddress,
        suburb: property.address.suburb,
        state: property.address.state,
        postcode: property.address.postcode,
      })
      .onConflictDoUpdate({
        target: [addresses.propertyId],
        set: {
          shortAddress: property.address.display.shortAddress,
          fullAddress: property.address.display.fullAddress,
          suburb: property.address.suburb,
          state: property.address.state,
          postcode: property.address.postcode,
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

      // Insert listing company
      if (property.listingCompany) {
        await db.insert(listingCompanies)
          .values({
            id: property.listingCompany.id,
            name: property.listingCompany.name,
            phoneNumber: property.listingCompany.phoneNumber,
            address: property.listingCompany.address,
            avgRating: property.listingCompany.ratingsReviews?.avgRating || null,
            totalReviews: property.listingCompany.ratingsReviews?.totalReviews || null,
          })
          .onConflictDoUpdate({
            target: listingCompanies.id,
            set: {
              name: property.listingCompany.name,
              phoneNumber: property.listingCompany.phoneNumber,
              address: property.listingCompany.address,
              avgRating: property.listingCompany.ratingsReviews?.avgRating || null,
              totalReviews: property.listingCompany.ratingsReviews?.totalReviews || null,
            }
          });
      }

      // Update or insert valuations
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