import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Users, Droplets, Wind, Coffee, Bed, ArrowRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function RoomsPage() {
  usePageMeta("Rooms & Suites", "Explore our thoughtfully designed rooms and suites, each crafted for comfort and effortless luxury.");
  const { data: categories, isLoading } = useQuery({
    queryKey: ["roomCategories"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/categories");
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      
      {/* Header */}
      <div className="py-20 px-6 text-center">
        <h1 className="font-serif text-5xl md:text-6xl text-hotel-black mb-6">Our Rooms & Suites</h1>
        <p className="max-w-2xl mx-auto text-hotel-black/60 leading-relaxed">
          Experience uncompromising luxury in our meticulously designed rooms and suites. 
          Every space is a sanctuary crafted to provide the ultimate in comfort and aesthetic pleasure.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-24 space-y-24">
        {isLoading ? (
          Array(3).fill(0).map((_,i) => <div key={i} className="h-96 bg-hotel-black/5 animate-pulse" />)
        ) : (categories ?? []).map((cat: any, index: number) => (
          <div key={cat._id} className={`flex flex-col md:flex-row gap-12 items-center ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
            {/* Image */}
            <div className="w-full md:w-1/2 relative group overflow-hidden">
              <div className="absolute inset-0 bg-hotel-black/20 group-hover:bg-transparent transition-colors duration-500 z-10" />
              <img src={cat.images?.[0] || "/placeholder.svg"}
                alt={cat.name} 
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>

            {/* Content */}
            <div className="w-full md:w-1/2 px-4 md:px-8">
              <div className="mb-4">
                <span className="text-xs tracking-[0.2em] uppercase text-hotel-gold-text font-semibold">Starts from ₹{cat.basePrice}</span>
              </div>
              <h2 className="font-serif text-4xl text-hotel-black mb-4">{cat.name}</h2>
              <p className="text-hotel-black/60 leading-relaxed mb-8">{cat.description}</p>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-8 text-sm text-hotel-black/70 border-y border-hotel-black/10 py-6">
                <div className="flex items-center gap-2"><Users size={16} className="text-hotel-gold"/> Up to {cat.capacity.adults} Adults</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 border border-hotel-gold flex items-center justify-center text-[8px] rounded">m²</span> {cat.size} sq.ft</div>
                <div className="flex items-center gap-2"><Bed size={16} className="text-hotel-gold"/> {cat.bedType || 'King Bed'}</div>
                <div className="flex items-center gap-2"><Wind size={16} className="text-hotel-gold"/> Climate Control</div>
              </div>

              <div className="flex gap-4">
                <Link to="/search">
                  <GoldButton className="px-8 py-3">Book Now</GoldButton>
                </Link>
                <Link to={`/rooms/${cat.slug}`} className="flex items-center gap-2 text-sm uppercase tracking-widest font-semibold text-hotel-black hover:text-hotel-gold transition-colors">
                  Details <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
