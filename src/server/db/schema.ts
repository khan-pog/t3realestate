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
  property_id: varchar("property_id").notNull(),
  short_address: varchar("short_address").notNull(),
  full_address: varchar("full_address").notNull(),
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
  phone_number: varchar("phone_number"),
  address: varchar("address"),
  avg_rating: numeric("avg_rating"),
  total_reviews: integer("total_reviews"),
});

export const properties = createTable("property", {
  id: varchar("id").primaryKey(),
  property_type: varchar("property_type").notNull(),
  property_link: varchar("property_link").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updated_at: timestamp("updated_at"),
  scraped_at: timestamp("scraped_at"),
});

export const propertyFeatures = createTable("property_features", {
  id: serial("id").primaryKey(),
  property_id: varchar("property_id").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parking_spaces: integer("parking_spaces"),
  land_size: numeric("land_size"),
  land_unit: varchar("land_unit"),
  building_size: numeric("building_size"),
  building_unit: varchar("building_unit"),
});

export const propertyImages = createTable("property_images", {
  id: serial("id").primaryKey(),
  property_id: varchar("property_id").notNull(),
  url: varchar("url").notNull(),
  order: integer("order").notNull(),
});

export const propertyValuations = createTable("property_valuations", {
  id: serial("id").primaryKey(),
  property_id: varchar("property_id").notNull(),
  source: varchar("source").notNull(),
  confidence: varchar("confidence"),
  estimated_value: varchar("estimated_value"),
  price_range: varchar("price_range"),
  last_updated: timestamp("last_updated"),
  rental_value: varchar("rental_value"),
  rental_period: varchar("rental_period"),
  rental_confidence: varchar("rental_confidence"),
});

export const propertyPrices = createTable("property_prices", {
  id: serial("id").primaryKey(),
  property_id: varchar("property_id").notNull(),
  display_price: varchar("display_price"),
  price_from: varchar("price_from"),
  price_to: varchar("price_to"),
  search_range: varchar("search_range"),
  price_information: varchar("price_information"),
  updated_at: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const importProgress = createTable("import_progress", {
  id: serial("id").primaryKey(),
  batchSize: integer("batch_size").notNull(),
  currentOffset: integer("current_offset").notNull(),
  totalItems: integer("total_items").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // 'in_progress', 'completed', 'failed'
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  error: text("error"),
});
