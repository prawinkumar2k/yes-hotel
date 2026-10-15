/**
 * Reads a photo from the camera / gallery as a JPEG data URL, scaled so its longer side is at most
 * `maxSide` px. Phone photos are 3-5 MB; this sends ~150-400 KB, still sharp enough to read an ID.
 * Non-image files (e.g. a PDF) are returned unchanged.
 */
export function imageFileToDataUrl(file: File, maxSide = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const original = reader.result as string;
      if (!file.type.startsWith("image/")) return resolve(original);
      const img = new Image();
      img.onerror = () => resolve(original);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(original);
        ctx.fillStyle = "#ffffff"; // transparent PNGs → white, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < original.length ? out : original);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
