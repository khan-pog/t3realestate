import { db } from "../server/db";
import { properties, addresses, propertyFeatures, propertyImages, propertyValuations, listingCompanies } from "../server/db/schema";
import { eq } from "drizzle-orm";
import searchData from "./search.json";

export async function importData() {
  try {
    for (const property of searchData) {
      try {
        // Check if property exists
        const existingProperty = await db.select()
          .from(properties)
          .where(eq(properties.id, property.id))
          .limit(1);

        if (existingProperty.length > 0) {
          // Update only if data has changed
          if (existingProperty[0].description !== property.description ||
              existingProperty[0].propertyLink !== property.propertyLink) {
            await db.update(properties)
              .set({
                propertyType: property.propertyType,
                propertyLink: property.propertyLink,
                description: property.description,
                updatedAt: new Date(),
              })
              .where(eq(properties.id, property.id));
            console.log(`Updated property ${property.id}`);
          }
        } else {
          // Insert new property
          await db.insert(properties).values({
            id: property.id,
            propertyType: property.propertyType,
            propertyLink: property.propertyLink,
            description: property.description,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`Inserted new property ${property.id}`);
        }

        // Handle address updates
        const existingAddress = await db.select()
          .from(addresses)
          .where(eq(addresses.propertyId, property.id))
          .limit(1);

        if (existingAddress.length > 0) {
          // Update only if address details have changed
          if (existingAddress[0].fullAddress !== property.address.display.fullAddress) {
            await db.update(addresses)
              .set({
                shortAddress: property.address.display.shortAddress,
                fullAddress: property.address.display.fullAddress,
                suburb: property.address.suburb,
                state: property.address.state,
                postcode: property.address.postcode,
              })
              .where(eq(addresses.propertyId, property.id));
          }
        } else {
          await db.insert(addresses).values({
            propertyId: property.id,
            shortAddress: property.address.display.shortAddress,
            fullAddress: property.address.display.fullAddress,
            suburb: property.address.suburb,
            state: property.address.state,
            postcode: property.address.postcode,
          });
        }

        // Handle property features updates
        const existingFeatures = await db.select()
          .from(propertyFeatures)
          .where(eq(propertyFeatures.propertyId, property.id))
          .limit(1);

        const newFeatures = {
          propertyId: property.id,
          bedrooms: property.generalFeatures?.bedrooms?.value ?? null,
          bathrooms: property.generalFeatures?.bathrooms?.value ?? null,
          parkingSpaces: property.generalFeatures?.parkingSpaces?.value ?? null,
          landSize: property.propertySizes?.land?.displayValue ? parseFloat(property.propertySizes.land.displayValue) : null,
          landUnit: property.propertySizes?.land?.sizeUnit?.displayValue || null,
          buildingSize: property.propertySizes?.building?.displayValue ? parseFloat(property.propertySizes.building.displayValue) : null,
          buildingUnit: property.propertySizes?.building?.sizeUnit?.displayValue || null,
        };

        if (existingFeatures.length > 0) {
          // Update only if features have changed
          if (JSON.stringify(existingFeatures[0]) !== JSON.stringify(newFeatures)) {
            await db.update(propertyFeatures)
              .set(newFeatures)
              .where(eq(propertyFeatures.propertyId, property.id));
          }
        } else {
          await db.insert(propertyFeatures).values(newFeatures);
        }

        // Handle images - delete existing and insert new if changed
        const existingImages = await db.select()
          .from(propertyImages)
          .where(eq(propertyImages.propertyId, property.id));

        const currentImageUrls = existingImages.map(img => img.url);
        const newImageUrls = property.images.map(url => url.replace("{size}", "800x600"));

        if (JSON.stringify(currentImageUrls) !== JSON.stringify(newImageUrls)) {
          // Delete existing images
          await db.delete(propertyImages)
            .where(eq(propertyImages.propertyId, property.id));

          // Insert new images
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
        }

        // Handle listing company updates with upsert
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

        // Handle valuation data
        if (property.valuationData) {
          try {
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
            }).onConflictDoUpdate({
              target: propertyValuations.propertyId,
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
            console.log(`Valuation data processed for property ${property.id}`);
          } catch (valuationError) {
            console.error(`Error processing valuation data for property ${property.id}:`, valuationError);
          }
        } else {
          console.warn(`No valuation data found for property ${property.id}`);
        }

      } catch (propertyError) {
        console.error(`Error processing property ${property.id}:`, propertyError);
        // Continue with next property
        continue;
      }
    }
    console.log('Data import completed successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}
  