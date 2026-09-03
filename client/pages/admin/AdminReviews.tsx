import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminReviews() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const res = await api.get("/admin/reviews");
      return res.data.data;
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/admin/reviews/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast({ title: "Success", description: "Review status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    },
  });

  const reviews = (data ?? []).filter((r: any) => filter === "ALL" || r.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">Customer Reviews</h1>
        <p className="text-hotel-black/60">Moderate reviews submitted by guests after checkout</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Guest</th>
              <th className="px-4 py-3 font-medium text-gray-500">Booking</th>
              <th className="px-4 py-3 font-medium text-gray-500">Rating</th>
              <th className="px-4 py-3 font-medium text-gray-500">Review</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No reviews found</td></tr>
            ) : (
              reviews.map((review: any) => (
                <tr key={review._id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-hotel-black">{review.user?.firstName} {review.user?.lastName}</div>
                    <div className="text-gray-500 text-xs">{review.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{review.booking?.bookingReference}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-hotel-gold">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-sm">
                    <div className="font-medium text-hotel-black">{review.title}</div>
                    <div className="text-gray-500 text-xs line-clamp-2">{review.comment}</div>
                    <div className="text-gray-400 text-[11px] mt-1">{format(new Date(review.createdAt), "MMM d, yyyy")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_STYLES[review.status]}>{review.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {review.status !== "APPROVED" && (
                        <Button variant="ghost" size="icon" onClick={() => moderateMutation.mutate({ id: review._id, status: "APPROVED" })} title="Approve">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {review.status !== "REJECTED" && (
                        <Button variant="ghost" size="icon" onClick={() => moderateMutation.mutate({ id: review._id, status: "REJECTED" })} title="Reject">
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
