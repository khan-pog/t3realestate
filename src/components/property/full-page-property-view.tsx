import Image from "next/image";
import { db } from "~/server/db";
import { properties, propertyImages, propertyFeatures, addresses, propertyValuations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Carousel } from "~/components/ui/carousel";
import { calculateOnePercentRule } from "~/lib/utils";

async function getPropertyDetails(id: string) {
  console.log('Fetching property details for ID:', id);
  
  const results = await db
    .select({
      property: {
        id: properties.id,
        propertyType: properties.propertyType,
        description: properties.description,
      },
      address: {
        shortAddress: addresses.shortAddress,
        fullAddress: addresses.fullAddress,
        suburb: addresses.suburb,
        state: addresses.state,
        postcode: addresses.postcode,
      },
      features: {
        bedrooms: propertyFeatures.bedrooms,
        bathrooms: propertyFeatures.bathrooms,
        parkingSpaces: propertyFeatures.parkingSpaces,
        landSize: propertyFeatures.landSize,
        landUnit: propertyFeatures.landUnit,
        buildingSize: propertyFeatures.buildingSize,
        buildingUnit: propertyFeatures.buildingUnit,
      },
      valuation: {
        estimatedValue: propertyValuations.estimatedValue,
        priceRange: propertyValuations.priceRange,
        confidence: propertyValuations.confidence,
        lastUpdated: propertyValuations.lastUpdated,
        rentalValue: propertyValuations.rentalValue,
      },
    })
    .from(properties)
    .leftJoin(addresses, eq(addresses.propertyId, properties.id))
    .leftJoin(propertyFeatures, eq(propertyFeatures.propertyId, properties.id))
    .leftJoin(propertyValuations, eq(propertyValuations.propertyId, properties.id))
    .where(eq(properties.id, id))
    .limit(1);

  console.log('Property query results:', results);

  if (results.length === 0) {
    console.error('No property found with ID:', id);
    throw new Error("Property not found");
  }

  // Get all images for the property
  const images = await db
    .select({
      url: propertyImages.url,
    })
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, id))
    .orderBy(propertyImages.order);

  console.log('Property images:', images);

  // Transform results to handle null values
  const propertyDetails = {
    ...results[0],
    images,
    address: {
      shortAddress: results[0].address?.shortAddress ?? 'Address unavailable',
      fullAddress: results[0].address?.fullAddress ?? '',
      suburb: results[0].address?.suburb ?? '',
      state: results[0].address?.state ?? '',
      postcode: results[0].address?.postcode ?? '',
    },
    features: {
      bedrooms: results[0].features?.bedrooms ?? null,
      bathrooms: results[0].features?.bathrooms ?? null,
      parkingSpaces: results[0].features?.parkingSpaces ?? null,
      landSize: results[0].features?.landSize ?? null,
      landUnit: results[0].features?.landUnit ?? null,
      buildingSize: results[0].features?.buildingSize ?? null,
      buildingUnit: results[0].features?.buildingUnit ?? null,
    },
    property: {
      id: results[0].property.id,
      propertyType: results[0].property.propertyType ?? 'Unknown type',
      description: results[0].property.description ?? '',
    },
    valuation: results[0].valuation ? {
      estimatedValue: results[0].valuation.estimatedValue ?? null,
      priceRange: results[0].valuation.priceRange ?? null,
      confidence: results[0].valuation.confidence ?? null,
      lastUpdated: results[0].valuation.lastUpdated ?? null,
      rentalValue: results[0].valuation.rentalValue ?? null,
    } : null
  };

  console.log('Final property details:', propertyDetails);
  return propertyDetails;
}

export default async function FullPagePropertyView({ id }: { id: string }) {
  const { property, address, features, valuation, images } = await getPropertyDetails(id);
  
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{address.shortAddress}</h1>
        <p className="text-lg text-gray-800 dark:text-gray-100">
          {address.suburb}, {address.state} {address.postcode}
        </p>
      </div>

      <div className="mb-8">
        <Carousel>
          {images.map((image, index) => (
            <div key={index} className="relative h-[400px] w-full">
              <Image
                src={image.url}
                alt={`Property image ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </Carousel>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Property Details</h2>
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Property Type</span>
              <p className="font-medium text-gray-900 dark:text-white">{property.propertyType}</p>
            </div>
            {features.bedrooms && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Bedrooms</span>
                <p className="font-medium text-gray-900 dark:text-white">{features.bedrooms}</p>
              </div>
            )}
            {features.bathrooms && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Bathrooms</span>
                <p className="font-medium text-gray-900 dark:text-white">{features.bathrooms}</p>
              </div>
            )}
            {features.parkingSpaces && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Parking</span>
                <p className="font-medium text-gray-900 dark:text-white">{features.parkingSpaces}</p>
              </div>
            )}
            {features.landSize && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Land Size</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {features.landSize} {features.landUnit}
                </p>
              </div>
            )}
            {features.buildingSize && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Building Size</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {features.buildingSize} {features.buildingUnit}
                </p>
              </div>
            )}
          </div>

          {property.description && (
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Description</h3>
              <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-100">{property.description}</p>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Valuation</h2>
          {valuation ? (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
              <div className="mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">Estimated Value</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${valuation.estimatedValue}</p>
              </div>
              {valuation.rentalValue && (
                <div className="mb-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Weekly Rental</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    ${valuation.rentalValue}
                  </p>
                  {(() => {
                    const onePercentRule = calculateOnePercentRule(
                      valuation.estimatedValue ? Number(valuation.estimatedValue.replace(/[$,]/g, '')) : null,
                      valuation.rentalValue ? Number(valuation.rentalValue.replace(/[$,]/g, '')) : null
                    );
                    
                    return onePercentRule && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">1% Rule Analysis</span>
                        <p className={`font-medium ${
                          onePercentRule >= 1 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {onePercentRule}%
                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                            ({onePercentRule >= 1 ? 'Meets 1% rule' : 'Below 1% rule'})
                          </span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
              {valuation.priceRange && (
                <div className="mb-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Price Range</span>
                  <p className="font-medium text-gray-900 dark:text-white">{valuation.priceRange}</p>
                </div>
              )}
              {valuation.confidence && (
                <div className="mb-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Confidence</span>
                  <p className="font-medium text-gray-900 dark:text-white">{valuation.confidence}</p>
                </div>
              )}
              {valuation.lastUpdated && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Last updated: {valuation.lastUpdated.toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-800 dark:text-gray-100">No valuation data available</p>
          )}
        </div>
      </div>
    </div>
  );
} 