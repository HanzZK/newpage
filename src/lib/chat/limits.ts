/**
 * Constants shared by the guest API routes and the client composer, so the
 * browser rejects an oversized file before spending the upload.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Formats Claude's vision API accepts. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_MESSAGE_CHARS = 2000;

/**
 * Longest edge, in pixels, that the browser downscales to before upload.
 * Keeps guest uploads cheap on mobile data and caps vision token spend.
 */
export const MAX_IMAGE_EDGE = 1568;

export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}
