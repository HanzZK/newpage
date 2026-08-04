import { MAX_IMAGE_EDGE } from "@/lib/chat/limits";

/**
 * Shrinks a photo in the browser before uploading.
 *
 * A modern phone camera produces 4–12 MB files. Guests are often on hotel
 * wifi or roaming data, and every pixel we keep is a vision token we pay for
 * in Phase 4. Downscaling to a 1568px long edge keeps text on an appliance
 * panel readable while cutting the payload by an order of magnitude.
 *
 * Falls back to the original file on any failure — a working upload beats a
 * clever one.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);

    if (longestEdge <= MAX_IMAGE_EDGE) {
      bitmap.close();
      return file;
    }

    const scale = MAX_IMAGE_EDGE / longestEdge;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });

    return blob ?? file;
  } catch {
    return file;
  }
}
