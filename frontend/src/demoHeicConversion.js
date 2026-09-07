import { heicTo } from "heic-to/csp";

function canvasBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The converted image is empty.")),
      type,
      quality,
    );
  });
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function convertDemoHeic(file) {
  let bitmap = null;
  try {
    bitmap = await heicTo({ blob: file, type: "bitmap" });
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image conversion is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let hasTransparency = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) {
        hasTransparency = true;
        break;
      }
    }
    const type = hasTransparency ? "image/png" : "image/jpeg";
    const blob = await canvasBlob(canvas, type, hasTransparency ? undefined : 0.92);
    return { blob, contentType: type, extension: hasTransparency ? ".png" : ".jpg" };
  } finally {
    bitmap?.close?.();
  }
}
