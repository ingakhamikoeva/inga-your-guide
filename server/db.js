// Shared pg.Pool for the API. Imported by routes, middleware and handlers.
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) console.warn("[boot] DATABASE_URL is not set");

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: /sslmode=require|sslmode=verify/.test(DATABASE_URL || "") ? { rejectUnauthorized: false } : false,
});
