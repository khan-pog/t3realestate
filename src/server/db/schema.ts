// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  serial,
  timestamp,
  varchar,
  numeric,
  integer,
  text,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `t3gallery_${name}`);

export const addresses = createTable("address", {
  id: serial("id").primaryKey(),
  propertyId: varchar("propertyid").notNull(),
  shortAddress: varchar("shortaddress").notNull(),
  fullAddress: varchar("fulladdress").notNull(),
  suburb: varchar("suburb").notNull(),
  state: varchar("state").notNull(),
  postcode: varchar("postcode").notNull(),
});

export const images = createTable(
  "image",
  {
    id: serial("id").primaryKey(),
    name: varchar("name").notNull(),
    url: varchar("url").notNull(),
    userId: varchar("userId").notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (example) => ({
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const listingCompanies = createTable("listing_companies", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  phoneNumber: varchar("phonenumber"),
  address: varchar("address"),
  avgRating: numeric("avgrating"),
  totalReviews: integer("totalreviews"),
});

export const properties = createTable("property", {
  id: varchar("id").primaryKey(),
  propertyType: varchar("propertytype").notNull(),
  propertyLink: varchar("propertylink").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedat"),
});

export const propertyFeatures = createTable("property_features", {
  id: serial("id").primaryKey(),
  propertyId: varchar("propertyid").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parkingSpaces: integer("parkingspaces"),
  landSize: numeric("landsize"),
  landUnit: varchar("landunit"),
  buildingSize: numeric("buildingsize"),
  buildingUnit: varchar("buildingunit"),
});

export const propertyImages = createTable("property_images", {
  id: serial("id").primaryKey(),
  propertyId: varchar("propertyid").notNull(),
  url: varchar("url").notNull(),
  order: integer("order").notNull(),
});

export const propertyValuations = createTable("property_valuations", {
  id: serial("id").primaryKey(),
  propertyId: varchar("propertyid").notNull(),
  source: varchar("source").notNull(),
  confidence: varchar("confidence"),
  estimatedValue: varchar("estimatedvalue"),
  priceRange: varchar("pricerange"),
  lastUpdated: timestamp("lastupdated"),
  rentalValue: varchar("rentalvalue"),
  rentalPeriod: varchar("rentalperiod"),
  rentalConfidence: varchar("rentalconfidence"),
});
