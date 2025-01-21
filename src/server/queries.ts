import "server-only";
import { db } from "./db";
import { auth } from "@clerk/nextjs/server";
import { images } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import analyticsServerClient from "./analytics";
import { properties, propertyImages, propertyFeatures, addresses, propertyValuations } from "./db/schema";
import { desc } from "drizzle-orm";

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

export async function getProperties() {
  try {
    console.log('Fetching properties...');
    const results = await db
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
      .leftJoin(propertyValuations, eq(propertyValuations.propertyId, properties.id))
      .orderBy(desc(properties.createdAt));

    console.log('Properties found:', results.length);
    return results;
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error;
  }
}
