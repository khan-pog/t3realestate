import { db } from "./db";
import { properties, addresses, propertyFeatures, propertyImages, propertyValuations, listingCompanies, propertyPrices, importProgress } from "./db/schema";
import { eq } from "drizzle-orm";
import searchData from "~/scripts/search.json";

type PropertyError = {
  propertyId: number;
  error: string;
};

export async function processBatch(startIndex: number, batchSize: number, importId: number) {
  const endIndex = Math.min(startIndex + batchSize, searchData.length);
  const batch = searchData.slice(startIndex, endIndex);
  const errors: PropertyError[] = [];

  for (const property of batch) {
    try {
      // Insert property with basic validation
      if (!property.id || !property.propertyType) {
        throw new Error('Missing required property fields');
      }

      await db.insert(properties).values({
        id: property.id,
        propertyType: property.propertyType,
        propertyLink: property.propertyLink || '',
        description: property.description || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        scrapedAt: property.scraped_at ? new Date(property.scraped_at) : new Date(),
      });

      // Handle address with better fallbacks and validation
      let shortAddress = '';
      try {
        shortAddress = property.address?.display?.shortAddress || 
          property.address?.fullAddress || 
          `${property.address?.suburb || ''}, ${property.address?.state || ''} ${property.address?.postcode || ''}`.trim();

        // If we still don't have a valid address, create a placeholder
        if (!shortAddress || shortAddress === ', ') {
          shortAddress = `Property ${property.id}`;
        }

        await db.insert(addresses).values({
          propertyid: property.id,
          shortaddress: shortAddress,
          fulladdress: property.address?.display?.fullAddress || shortAddress,
          suburb: property.address?.suburb || 'Unknown',
          state: property.address?.state || 'Unknown',
          postcode: property.address?.postcode || '',
        });
      } catch (addressError) {
        console.warn(`Address error for property ${property.id}:`, addressError);
        // Continue with other property data even if address fails
      }

      // Insert features with null safety
      try {
        await db.insert(propertyFeatures).values({
          propertyid: property.id,
          bedrooms: property.generalFeatures?.bedrooms?.value ?? null,
          bathrooms: property.generalFeatures?.bathrooms?.value ?? null,
          parkingspaces: property.generalFeatures?.parkingSpaces?.value ?? null,
          landsize: property.propertySizes?.land?.displayValue ? 
            parseFloat(property.propertySizes.land.displayValue) || null : null,
          landunit: property.propertySizes?.land?.sizeUnit?.displayValue || null,
          buildingsize: property.propertySizes?.building?.displayValue ? 
            parseFloat(property.propertySizes.building.displayValue) || null : null,
          buildingunit: property.propertySizes?.building?.sizeUnit?.displayValue || null,
        });
      } catch (featuresError) {
        console.warn(`Features error for property ${property.id}:`, featuresError);
      }

      // Insert images
      if (property.images && Array.isArray(property.images) && property.images.length > 0) {
        await Promise.all(
          property.images.map((url: string, index: number) =>
            db.insert(propertyImages).values({
              propertyid: property.id,
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
            phonenumber: property.listingCompany.phoneNumber,
            address: property.listingCompany.address,
            avgrating: property.listingCompany.ratingsReviews?.avgRating || null,
            totalreviews: property.listingCompany.ratingsReviews?.totalReviews || null,
          })
          .onConflictDoUpdate({
            target: listingCompanies.id,
            set: {
              name: property.listingCompany.name,
              phonenumber: property.listingCompany.phoneNumber,
              address: property.listingCompany.address,
              avgrating: property.listingCompany.ratingsReviews?.avgRating || null,
              totalreviews: property.listingCompany.ratingsReviews?.totalReviews || null,
            }
          });
      }

      // Insert valuations
      if (property.valuationData) {
        await db.insert(propertyValuations).values({
          propertyid: property.id,
          source: property.valuationData.source,
          confidence: property.valuationData.confidence || null,
          estimatedvalue: property.valuationData.estimatedValue || null,
          pricerange: property.valuationData.priceRange || null,
          lastupdated: new Date(),
          rentalvalue: property.valuationData.rental?.value || null,
          rentalperiod: property.valuationData.rental?.period || null,
          rentalconfidence: property.valuationData.rental?.confidence || null,
        });
      }

      // Insert prices
      if (property.price || property.priceDetails) {
        await db.insert(propertyPrices).values({
          propertyid: property.id,
          displayprice: property.price?.display || null,
          pricefrom: property.priceDetails?.from || null,
          priceto: property.priceDetails?.to || null,
          searchrange: property.price?.searchRange || null,
          priceinformation: property.price?.information || null,
          updatedat: new Date(),
        });
      }
    } catch (error) {
      console.error(`Error processing property ${property.id}:`, error);
      errors.push({ 
        propertyId: property.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Continue with next property
      continue;
    }
  }

  // Update progress and include any errors
  try {
    await db.update(importProgress)
      .set({ 
        currentOffset: endIndex,
        updatedAt: new Date(),
        status: endIndex >= searchData.length ? 'completed' : 'in_progress',
        error: errors.length > 0 ? JSON.stringify(errors) : null
      })
      .where(eq(importProgress.id, importId));
  } catch (updateError) {
    console.error('Error updating import progress:', updateError);
  }

  return endIndex >= searchData.length;
} 