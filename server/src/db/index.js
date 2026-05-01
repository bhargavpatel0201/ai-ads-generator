import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

let cachedDb;

export function hasDbConfig() {
  return Boolean(process.env.DATABASE_URL);
}

function dbNotConfiguredError() {
  const err = new Error(
    "Database is not configured. Please set server/.env -> DATABASE_URL (Neon connection string)."
  );
  // @ts-ignore
  err.statusCode = 503;
  return err;
}

export function getDb() {
  if (cachedDb) return cachedDb;

  if (!process.env.DATABASE_URL) {
    throw dbNotConfiguredError();
  }

  const sql = neon(process.env.DATABASE_URL);
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}

export default getDb;
