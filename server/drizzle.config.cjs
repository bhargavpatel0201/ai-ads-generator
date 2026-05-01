const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

/** @type {import("drizzle-kit").Config} */
module.exports = {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
