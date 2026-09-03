/**
 * usePublicData — TanStack Query hooks for public CMS data.
 * Use these in public-facing pages to load live CMS content
 * instead of hardcoded values.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
