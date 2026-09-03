import { useState } from "react";
import Navbar from "@/components/hotel/Navbar";
import { useGallery } from "@/hooks/usePublicData";
import { Loader2, ImageOff } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "HOTEL", label: "Hotel" },
  { value: "ROOMS", label: "Rooms" },
  { value: "DINING", label: "Dining" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "EXPERIENCE", label: "Experience" },
  { value: "EVENTS", label: "Events" },
];

export default function GalleryPage() {
  usePageMeta("Gallery", "A visual tour of YES Hotels — our rooms, dining, amenities, and exteriors.");
  const [activeCategory, setActiveCategory] = useState("");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const { data: images, isLoading, isError } = useGallery({
    category: activeCategory || undefined,
    limit: 100
  });

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="font-serif text-5xl text-hotel-black mb-6">Gallery</h1>
          <p className="text-hotel-black/60 max-w-2xl mx-auto">
            A visual journey through the exceptional spaces, amenities, and experiences that define YES Hotels.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-5 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                activeCategory === cat.value
                  ? "bg-hotel-gold border-hotel-gold text-hotel-black"
                  : "border-gray-300 text-gray-600 hover:border-hotel-gold hover:text-hotel-gold bg-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-hotel-gold" />
          </div>
        )}

        {isError && (
          <div className="text-center py-20">
            <ImageOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Gallery temporarily unavailable. Please try again later.</p>
          </div>
        )}

        {!isLoading && !isError && images?.length === 0 && (
          <div className="text-center py-20">
            <ImageOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No images in this category yet.</p>
          </div>
        )}

        {!isLoading && !isError && images && images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img: any) => (
              <div
                key={img._id}
                className="group relative overflow-hidden bg-hotel-black aspect-square cursor-pointer"
                onClick={() => setLightboxImg(img.imageUrl)}
              >
                <div className="absolute inset-0 bg-hotel-black/20 group-hover:bg-transparent transition-colors duration-500 z-10" />
                <img
                  src={img.imageUrl}
                  alt={img.altText}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                {img.title && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white font-medium">{img.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Gallery"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-hotel-gold"
            onClick={() => setLightboxImg(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
