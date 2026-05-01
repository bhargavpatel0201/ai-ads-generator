import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Supabase Auth user id (JWT `sub`) */
  authUserId: varchar("auth_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  imageUrl: varchar("image_url", { length: 500 }),
  /**
   * Remaining LinkedIn-post generations in the current cycle. See lib/plan-quota.js for
   * per-plan limits. New rows start at the free-tier limit; the route auto-resets when
   * `creditsResetAt` is in the past.
   */
  credits: integer("credits").notNull().default(5),
  /** Next time `credits` should be refilled to the plan's limit (UTC, 1st of next month). */
  creditsResetAt: timestamp("credits_reset_at"),
  isSubscribed: boolean("is_subscribed").notNull().default(false),
  /** 'free' | 'pro' | 'premium' — set by Stripe webhooks; keeps paid tiers when you add more than on/off. */
  planTier: varchar("plan_tier", { length: 20 }).notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Public LinkedIn-post shares. Each row backs a `/share/:id` URL that LinkedIn / Twitter /
 * Slack can crawl for OG previews. No FK to `users` because shares are anonymous on
 * purpose — anyone who hits Share gets a public, bookmarkable link.
 */
export const linkedinShares = pgTable("linkedin_shares", {
  /** nanoid (URL-safe). 10 chars => > 100^10 keyspace, plenty for an indie demo. */
  id: varchar("id", { length: 24 }).primaryKey(),
  topic: varchar("topic", { length: 255 }).notNull(),
  /** Full post body. Bounded to LinkedIn's 3000-char limit + slack at the route layer. */
  post: text("post").notNull(),
  /** Cloudinary or other public HTTPS URL to the composited PNG. Required. */
  imageUrl: text("image_url").notNull(),
  /** Optional pre-overlay image for debugging / re-composite. */
  originalImageUrl: text("original_image_url"),
  /** Tracks how many times the page has been served, for fun analytics. */
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

