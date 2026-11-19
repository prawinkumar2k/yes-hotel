/**
 * Turns whatever was stored for an uploaded ID document into something a browser can show.
 * Uploads may be stored as a data URL, a full link, a server path ("/uploads/x.jpg") or bare base64.
 */
export function docImageSrc(raw: unknown): { src: string; kind: "image" | "pdf" | "none" } {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return { src: "", kind: "none" };
  if (v.startsWith("data:application/pdf") || /\.pdf($|\?)/i.test(v)) return { src: v, kind: "pdf" };
  if (v.startsWith("data:image") || v.startsWith("blob:") || /^https?:\/\//i.test(v)) return { src: v, kind: "image" };
  if (v.startsWith("//")) return { src: `https:${v}`, kind: "image" };
  if (v.startsWith("/") || /^(uploads|api)\//i.test(v)) return { src: v.startsWith("/") ? v : `/${v}`, kind: "image" };
  // Bare base64 with no "data:" prefix (JPEG starts /9j/, PNG iVBOR, GIF R0lG, WebP UklG).
  if (/^[A-Za-z0-9+/=\s]{100,}$/.test(v)) {
    const mime = v.startsWith("/9j/") ? "jpeg" : v.startsWith("iVBOR") ? "png" : v.startsWith("R0lG") ? "gif" : v.startsWith("UklG") ? "webp" : v.startsWith("JVBER") ? "pdf" : "jpeg";
    return mime === "pdf" ? { src: `data:application/pdf;base64,${v}`, kind: "pdf" } : { src: `data:image/${mime};base64,${v}`, kind: "image" };
  }
  return { src: "", kind: "none" };
}
