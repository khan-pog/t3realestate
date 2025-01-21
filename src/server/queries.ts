import "server-only";
import { db } from "./db";
import { auth } from "@clerk/nextjs/server";
import { images } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import analyticsServerClient from "./analytics";
import { properties, propertyImages, propertyFeatures, addresses, propertyValuations } from "./db/schema";
import { desc, asc } from "drizzle-orm";

export async function getMyImages() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const images = await db.query.images.findMany({
    where: (model, { eq }) => eq(model.userId, user.userId),
    orderBy: (model, { desc }) => desc(model.id),
  });

  return images;
}

export async function getImage(id: number) {
  const user = auth();
  if (!user.userId) throw new Error("Unauthorized");

  const image = await db.query.images.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  if (!image) throw new Error("Image not found");

  if (image.userId !== user.userId) throw new Error("Unauthorized");

  return image;
}

export async function deleteImage(id: number) {
  const user = auth();
  if (!user.userId) throw new Error("Unauthorized");

  await db
    .delete(images)
    .where(and(eq(images.id, id), eq(images.userId, user.userId)));

  analyticsServerClient.capture({
    distinctId: user.userId,
    event: "delete image",
    properties: {
      imageId: id,
    },
  });

  redirect("/");
}

type SortOption = 'newest' | 'price-high' | 'price-low' | 'beds';

export async function getProperties(sortBy: SortOption = 'newest') {
  try {
    console.log('Fetching properties with sort:', sortBy);
    const query = db
      .select({
        property: {
          id: properties.id,
          propertyType: properties.propertyType,
          description: properties.description,
        },
        address: {
          shortAddress: addresses.shortAddress,
          suburb: addresses.suburb,
          state: addresses.state,
        },
        features: {
          bedrooms: propertyFeatures.bedrooms,
          bathrooms: propertyFeatures.bathrooms,
          parkingSpaces: propertyFeatures.parkingSpaces,
        },
        primaryImage: {
          url: propertyImages.url,
        },
        valuation: {
          estimatedValue: propertyValuations.estimatedValue,
          rentalValue: propertyValuations.rentalValue,
          lastUpdated: propertyValuations.lastUpdated,
        },
      })
      .from(properties)
      .leftJoin(addresses, eq(addresses.propertyId, properties.id))
      .leftJoin(propertyFeatures, eq(propertyFeatures.propertyId, properties.id))
      .leftJoin(
        propertyImages,
        and(
          eq(propertyImages.propertyId, properties.id),
          eq(propertyImages.order, 1)
        )
      )
      .leftJoin(propertyValuations, eq(propertyValuations.propertyId, properties.id));

    // Apply sorting based on parameter
    switch (sortBy) {
      case 'price-high':
        // Convert string price to number for sorting
        query.orderBy((fields) => 
          sql`CAST(REPLACE(REPLACE(${propertyValuations.estimatedValue}, '$', ''), ',', '') AS DECIMAL) DESC NULLS LAST`
        );
        break;
      case 'price-low':
        query.orderBy((fields) => 
          sql`CAST(REPLACE(REPLACE(${propertyValuations.estimatedValue}, '$', ''), ',', '') AS DECIMAL) ASC NULLS LAST`
        );
        break;
      case 'beds':
        query.orderBy(desc(propertyFeatures.bedrooms));
        break;
      case 'newest':
      default:
        query.orderBy(desc(properties.createdAt));
    }

    const results = await query;
    console.log('Properties found:', results.length);
    return results;
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error;
  }
}
