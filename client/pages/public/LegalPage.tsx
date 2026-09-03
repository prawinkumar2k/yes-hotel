import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/hotel/Navbar";

export default function LegalPage({ contentKey, title }: { contentKey: string, title: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["content", contentKey],
    queryFn: async () => {
      try {
        const res = await api.get(`/content/${contentKey}`);
        return res.data.data;
      } catch (error) {
        return null;
      }
    }
  });

  return (
    <>
      <Navbar transparent={false} />
      <div className="pt-24 pb-16 bg-hotel-ivory min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-serif text-hotel-black mb-8 text-center">{title}</h1>
          
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>
          ) : data ? (
            <div className="bg-white p-8 md:p-12 shadow-sm rounded-lg prose prose-stone max-w-none">
              {data.title && <h2>{data.title}</h2>}
              {data.subtitle && <h3 className="text-hotel-black/60">{data.subtitle}</h3>}
              <div className="mt-6 whitespace-pre-wrap font-sans text-hotel-black/80 leading-relaxed">
                {data.description}
              </div>
              <div className="mt-12 text-sm text-hotel-black/60 border-t pt-4">
                Last updated: {new Date(data.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center shadow-sm rounded-lg">
              <p className="text-hotel-black/60">This content is currently being updated. Please check back later.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
