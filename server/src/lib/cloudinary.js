/**
 * Cloudinary uploader for the composited LinkedIn header PNG.
 *
 * Configuration (any one of these works; the SDK is initialised lazily):
 *   - `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`  (preferred)
 *   - or set all three: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
 *
 * If nothing is configured, callers receive `null` and fall back to the Replicate URL.
 */

import { v2 as cloudinaryV2 } from "cloudinary";

let configured = false;
let configError = null;

function tryConfigure() {
  if (configured || configError) return;
  try {
    if (process.env.CLOUDINARY_URL) {
      cloudinaryV2.config(); // SDK reads CLOUDINARY_URL automatically.
      configured = true;
      return;
    }
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY || process.env.Cloudinary_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (cloud_name && api_key && api_secret) {
      cloudinaryV2.config({ cloud_name, api_key, api_secret, secure: true });
      configured = true;
      return;
    }
    configError = new Error(
      "Cloudinary not configured — set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET in server/.env"
    );
  } catch (err) {
    configError = err;
  }
}

export function isCloudinaryConfigured() {
  tryConfigure();
  return configured;
}

function slugifyForPublicId(input, fallback = "linkedin-post") {
  const slug = String(input || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Upload a PNG buffer (the composited LinkedIn banner) and return its `secure_url`.
 * Returns `null` if Cloudinary isn’t configured. Logs and returns `null` on transient errors
 * so the rest of the response still ships with the data URL + Replicate fallback.
 *
 * @param {Buffer} buffer        Raw PNG bytes from Sharp.
 * @param {object} [opts]
 * @param {string} [opts.topic]  Used for the public_id slug.
 * @param {string} [opts.folder] Cloudinary folder, default `linkedin-studio/posts`.
 * @returns {Promise<string|null>}
 */
export async function uploadBannerToCloudinary(buffer, { topic = "", folder = "linkedin-studio/posts" } = {}) {
  if (!isCloudinaryConfigured()) {
    if (configError) console.warn(`[cloudinary] ${configError.message}`);
    return null;
  }

  const publicId = `${slugifyForPublicId(topic)}-${Date.now()}`;

  return new Promise((resolve) => {
    const uploadStream = cloudinaryV2.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        format: "png",
        overwrite: false,
        tags: ["linkedin-studio"],
      },
      (err, result) => {
        if (err) {
          console.warn("[cloudinary] upload failed", err.message || err);
          return resolve(null);
        }
        if (!result?.secure_url) {
          console.warn("[cloudinary] upload returned no secure_url");
          return resolve(null);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
