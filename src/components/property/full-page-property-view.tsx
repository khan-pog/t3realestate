import Image from "next/image";
import { db } from "~/server/db";
import { properties, propertyImages, propertyFeatures, addresses, propertyValuations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Carousel } from "~/components/ui/carousel";

async function getPropertyDetails(id: string) {
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
      },
    })
    .from(properties)
    .leftJoin(addresses, eq(addresses.propertyId, properties.id))
    .leftJoin(propertyFeatures, eq(propertyFeatures.propertyId, properties.id))
    .leftJoin(propertyValuations, eq(propertyValuations.propertyId, properties.id))
    .where(eq(properties.id, id))
    .limit(1);

  const images = await db
    .select({
      url: propertyImages.url,
    })
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, id))
    .orderBy(propertyImages.order);

  if (results.length === 0) {
    throw new Error("Property not found");
  }

  return { ...results[0], images };
}

export default async function FullPagePropertyView({ id }: { id: string }) {
  const { property, address, features, valuation, images } = await getPropertyDetails(id);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{address.shortAddress}</h1>
        <p className="text-lg text-gray-600">
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
          <h2 className="mb-4 text-2xl font-semibold">Property Details</h2>
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
            <div>
              <span className="text-sm text-gray-500">Property Type</span>
              <p className="font-medium">{property.propertyType}</p>
            </div>
            {features.bedrooms && (
              <div>
                <span className="text-sm text-gray-500">Bedrooms</span>
                <p className="font-medium">{features.bedrooms}</p>
              </div>
            )}
            {features.bathrooms && (
              <div>
                <span className="text-sm text-gray-500">Bathrooms</span>
                <p className="font-medium">{features.bathrooms}</p>
              </div>
            )}
            {features.parkingSpaces && (
              <div>
                <span className="text-sm text-gray-500">Parking</span>
                <p className="font-medium">{features.parkingSpaces}</p>
              </div>
            )}
            {features.landSize && (
              <div>
                <span className="text-sm text-gray-500">Land Size</span>
                <p className="font-medium">
                  {features.landSize} {features.landUnit}
                </p>
              </div>
            )}
            {features.buildingSize && (
              <div>
                <span className="text-sm text-gray-500">Building Size</span>
                <p className="font-medium">
                  {features.buildingSize} {features.buildingUnit}
                </p>
              </div>
            )}
          </div>

          {property.description && (
            <div className="mb-6">
              <h3 className="mb-2 text-xl font-semibold">Description</h3>
              <p className="whitespace-pre-wrap text-gray-600">{property.description}</p>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Valuation</h2>
          {valuation ? (
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-4">
                <span className="text-sm text-gray-500">Estimated Value</span>
                <p className="text-2xl font-bold">${valuation.estimatedValue}</p>
              </div>
              {valuation.priceRange && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Price Range</span>
                  <p className="font-medium">{valuation.priceRange}</p>
                </div>
              )}
              {valuation.confidence && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Confidence</span>
                  <p className="font-medium">{valuation.confidence}</p>
                </div>
              )}
              {valuation.lastUpdated && (
                <div className="text-sm text-gray-500">
                  Last updated: {valuation.lastUpdated.toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No valuation data available</p>
          )}
        </div>
      </div>
    </div>
  );
} 