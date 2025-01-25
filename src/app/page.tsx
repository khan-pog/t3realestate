import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { getProperties } from "~/server/queries";
import Image from "next/image";
import { calculateOnePercentRule } from "~/lib/utils";
import SortSelect from '~/components/property/sort-select';

export const dynamic = "force-dynamic";

function PropertyCard({ property, address, features, primaryImage, valuation, price }: Awaited<ReturnType<typeof getProperties>>[0]) {
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
        <Image
          src={primaryImage?.url ?? '/placeholder-property-image.jpg'}
          alt={address?.shortAddress ?? "Property"}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {address?.shortAddress ?? 'Address unavailable'}
          {address?.suburb && address?.state && (
            <span className="text-sm text-gray-700 dark:text-gray-200">
              , {address.suburb} {address.state}
            </span>
          )}
        </h3>
        <div className="mb-2 flex gap-4 text-sm text-gray-800 dark:text-gray-100">
          {features?.bedrooms !== null && <span>{features.bedrooms} beds</span>}
          {features?.bathrooms !== null && <span>{features.bathrooms} baths</span>}
          {features?.parkingSpaces !== null && <span>{features.parkingSpaces} parking</span>}
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-100">
          <div>{property.propertyType ?? 'Unknown type'}</div>
          {price?.displayPrice && (
            <div className="mt-1 font-bold text-gray-900 dark:text-white">
              {price.displayPrice}
            </div>
          )}
          {valuation?.estimatedValue && (
            <>
              <div className="mt-1 font-semibold text-gray-700 dark:text-gray-300">
                Est. {valuation.estimatedValue}
              </div>
              {valuation.rentalValue && (
                <div className="mt-1 text-sm">
                  Weekly Rent: ${valuation.rentalValue}
                  {onePercentRule !== null && (
                    <span className={`ml-2 font-medium ${onePercentRule >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ({onePercentRule.toFixed(2)}% Rule)
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

async function Properties({ searchParams }: { searchParams: { sort?: string } }) {
  const properties = await getProperties(searchParams.sort as any || 'one-percent');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end px-4">
        <SortSelect />
      </div>
      <div className="flex flex-wrap justify-center gap-6 p-4">
        {properties.map((property) => (
          <PropertyCard key={property.property.id} {...property} />
        ))}
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  return (
    <main className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Featured Properties</h1>
      <SignedOut>
        <div className="text-center text-2xl">
          Please sign in to view properties
        </div>
      </SignedOut>
      <SignedIn>
        <Properties searchParams={searchParams} />
      </SignedIn>
    </main>
  );
}
