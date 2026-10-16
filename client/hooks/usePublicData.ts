/**
 * usePublicData — TanStack Query hooks for public CMS data.
 * Use these in public-facing pages to load live CMS content
 * instead of hardcoded values.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { HOTEL, hotelAddressOneLine } from "@shared/hotel-info";

// ── Settings ──────────────────────────────────────────────
export function useHotelSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings");
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
    retry: 1,
  });
}

// ── Gallery ────────────────────────────────────────────────
export function useGallery(params?: { category?: string; featured?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ["public-gallery", params],
    queryFn: async () => {
      let url = "/public/gallery";
      const parts: string[] = [];
      if (params?.category) parts.push(`category=${params.category}`);
      if (params?.featured !== undefined) parts.push(`featured=${params.featured}`);
      if (params?.limit) parts.push(`limit=${params.limit}`);
      if (parts.length) url += "?" + parts.join("&");

      const res = await api.get(url);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}

// ── FAQs ───────────────────────────────────────────────────
export function useFAQs() {
  return useQuery({
    queryKey: ["public-faqs"],
    queryFn: async () => {
      const res = await api.get("/public/faqs");
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

// ── Testimonials ───────────────────────────────────────────
export function useTestimonials() {
  return useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const res = await api.get("/public/testimonials");
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

// ── Website Content (section-specific) ────────────────────
export function useContent(section: string) {
  return useQuery({
    queryKey: ["public-content", section],
    queryFn: async () => {
      const res = await api.get(`/public/content/${section}`);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

// ── Room Categories (public) ───────────────────────────────
export function usePublicRooms() {
  return useQuery({
    queryKey: ["public-rooms"],
    queryFn: async () => {
      const res = await api.get("/public/rooms");
      return res.data.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}

// ── Hotel contact details ──────────────────────────────────
const time12 = (hhmm?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};

/**
 * The hotel's name, phone, email, address and check-in / check-out times as set in
 * Admin → Settings (the database). The built-in facts are only a fallback while loading or offline.
 */
export function useHotelContact() {
  const { data } = useHotelSettings();
  return hotelContactFrom(data);
}

export function hotelContactFrom(s: any) {
  const phone = (s?.phone || HOTEL.phones[0]) as string;
  const whatsapp = String(s?.whatsappNumber || phone).replace(/\D/g, "");
  return {
    name: (s?.hotelName || HOTEL.name) as string,
    phone,
    phoneHref: `tel:${phone.replace(/[^\d+]/g, "")}`,
    whatsappHref: `https://wa.me/${whatsapp.length === 10 ? `91${whatsapp}` : whatsapp}`,
    email: (s?.email || "") as string,
    address: (s?.address || hotelAddressOneLine()) as string,
    mapsUrl: (s?.googleMapsUrl || HOTEL.mapsUrl) as string,
    instagramUrl: (s?.instagramUrl || HOTEL.instagramUrl) as string,
    checkIn: time12(s?.checkInTime) || HOTEL.checkIn,
    checkOut: time12(s?.checkOutTime) || HOTEL.checkOut,
  };
}

/** Lowest nightly rate among the active room types (Admin → Room Categories), for "From ₹…" labels. */
export function useStartingPrice() {
  const { data } = useQuery({
    queryKey: ["public-room-categories"],
    queryFn: async () => (await api.get("/rooms/categories")).data.data as { basePrice?: number; isActive?: boolean }[],
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
  const prices = (data ?? []).filter((c) => c.isActive !== false && Number(c.basePrice) > 0).map((c) => Number(c.basePrice));
  return prices.length ? Math.min(...prices) : null;
}
