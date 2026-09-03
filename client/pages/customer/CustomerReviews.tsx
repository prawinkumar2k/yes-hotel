import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";

export default function CustomerReviews() {
  const { user } = useAuth();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["myReviews"],
    queryFn: async () => {
      const res = await fetch("/api/reviews/my", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <div className="bg-hotel-black text-hotel-white px-6 py-4 flex items-center gap-4">
        <Link to="/customer/dashboard" className="font-serif text-lg tracking-widest uppercase text-hotel-gold">YES HOTELS</Link>
        <span className="text-hotel-white/30">/</span>
        <span className="text-hotel-white/70 text-sm">My Reviews</span>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl text-hotel-black">My Reviews</h1>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">{[1,2].map(i=><div key={i} className="h-32 bg-hotel-black/5"/>)}</div>
        ) : reviews?.length === 0 ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <Star size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50 mb-4">You haven't written any reviews yet.</p>
            <p className="text-sm text-hotel-black/40">You can write a review after checking out of your stay.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews?.map((r: any) => (
              <div key={r._id} className="bg-hotel-white border border-hotel-black/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Link to={`/customer/bookings/${r.booking}`} className="text-sm font-medium text-hotel-gold hover:underline">
                      Booking Reference
                    </Link>
                    <p className="text-xs text-hotel-black/50 mt-1">
                      Submitted on {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 text-hotel-gold">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={16} fill={star <= r.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                </div>
                
                <p className="text-hotel-black/80">{r.comment}</p>
                
                <div className="mt-4 pt-4 border-t border-hotel-black/10 flex justify-between items-center text-sm">
                  <span className={`px-2 py-1 rounded font-medium ${
                    r.status === "APPROVED" ? "bg-green-100 text-green-800" :
                    r.status === "REJECTED" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
