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

      // Insert features
      await db.insert(propertyFeatures).values({
        propertyId: property.id,
        bedrooms: property.generalFeatures?.bedrooms?.value ?? null,
        bathrooms: property.generalFeatures?.bathrooms?.value ?? null,
        parkingSpaces: property.generalFeatures?.parkingSpaces?.value ?? null,
        landSize: property.propertySizes?.land?.displayValue ? parseFloat(property.propertySizes.land.displayValue) : null,
        landUnit: property.propertySizes?.land?.sizeUnit?.displayValue || null,
        buildingSize: property.propertySizes?.building?.displayValue ? parseFloat(property.propertySizes.building.displayValue) : null,
        buildingUnit: property.propertySizes?.building?.sizeUnit?.displayValue || null,
      });

      // Insert images
      if (property.images && property.images.length > 0) {
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

      // Insert valuations
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
        });
      }

      // Insert prices
      if (property.price || property.priceDetails) {
        await db.insert(propertyPrices).values({
          propertyId: property.id,
          displayPrice: property.price?.display || null,
          priceFrom: property.priceDetails?.from || null,
          priceTo: property.priceDetails?.to || null,
          searchRange: property.price?.searchRange || null,
          priceInformation: property.price?.information || null,
          updatedAt: new Date(),
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