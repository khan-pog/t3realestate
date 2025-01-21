import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { getProperties } from "~/server/queries";
import Image from "next/image";
import { calculateOnePercentRule } from "~/lib/utils";

export const dynamic = "force-dynamic";

function PropertyCard({ property, address, features, primaryImage, valuation }: Awaited<ReturnType<typeof getProperties>>[0]) {
  const onePercentRule = calculateOnePercentRule(
    valuation?.estimatedValue ? Number(valuation.estimatedValue.replace(/[$,]/g, '')) : null,
    valuation?.rentalValue ? Number(valuation.rentalValue.replace(/[$,]/g, '')) : null
  );

  return (
    <Link
      href={`/property/${property.id}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-md transition-all hover:shadow-xl sm:w-[300px]"
    >
      <div className="relative h-48 w-full overflow-hidden">
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={address?.shortAddress ?? "Property"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
            <span className="text-gray-800 dark:text-gray-200">No image available</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {address?.shortAddress}
          <span className="text-sm text-gray-700 dark:text-gray-200">
            , {address?.suburb} {address?.state}
          </span>
        </h3>
        <div className="mb-2 flex gap-4 text-sm text-gray-800 dark:text-gray-100">
          {features?.bedrooms && <span>{features.bedrooms} beds</span>}
          {features?.bathrooms && <span>{features.bathrooms} baths</span>}
          {features?.parkingSpaces && <span>{features.parkingSpaces} parking</span>}
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-100">
          <div>{property.propertyType}</div>
          {valuation?.estimatedValue && (
            <>
              <div className="mt-1 font-bold text-gray-900 dark:text-white">
                Est. ${valuation.estimatedValue}
              </div>
              {valuation.rentalValue && (
                <div className="mt-1 text-sm">
                  Weekly Rent: ${valuation.rentalValue}
                  {onePercentRule && (
                    <span className={`ml-2 font-medium ${onePercentRule >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                      ({onePercentRule}% Rule)
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

async function Properties() {
  const properties = await getProperties();

  return (
    <div className="flex flex-wrap justify-center gap-6 p-4">
      {properties.map((property) => (
        <PropertyCard key={property.property.id} {...property} />
      ))}
    </div>
  );
}

export default async function HomePage() {
  return (
    <main className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Featured Properties</h1>
      <SignedOut>
        <div className="text-center text-2xl">
          Please sign in to view properties
        </div>
      </SignedOut>
      <SignedIn>
        <Properties />
      </SignedIn>
    </main>
  );
}
