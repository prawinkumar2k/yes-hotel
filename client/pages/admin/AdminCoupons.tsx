import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Edit, Trash2, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function AdminCoupons() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const res = await api.get("/coupons");
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCoupon) {
        const res = await api.patch(`/coupons/${editingCoupon._id}`, data);
        return res.data;
      } else {
        const res = await api.post("/coupons", data);
        return res.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast({ title: "Success", description: "Coupon saved successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to save", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/coupons/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast({ title: "Success", description: "Coupon deleted successfully" });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      code: fd.get("code") as string,
      description: fd.get("description") as string,
      discountType: fd.get("discountType") as string,
      discountValue: Number(fd.get("discountValue")),
      startDate: fd.get("startDate") as string,
      expiryDate: fd.get("expiryDate") as string,
      isActive: fd.get("isActive") === "true",
      perUserLimit: Number(fd.get("perUserLimit")) || 1
    };

    const minAmount = fd.get("minBookingAmount");
    if (minAmount) data.minBookingAmount = Number(minAmount);

    const maxDiscount = fd.get("maxDiscount");
    if (maxDiscount) data.maxDiscount = Number(maxDiscount);

    const usageLimit = fd.get("usageLimit");
    if (usageLimit) data.usageLimit = Number(usageLimit);

    saveMutation.mutate(data);
  };

  const getStatusBadge = (coupon: any) => {
    if (!coupon.isActive) return <Badge variant="destructive">Inactive</Badge>;
    const now = new Date();
    const start = new Date(coupon.startDate);
    const expiry = new Date(coupon.expiryDate);
    
    if (now < start) return <Badge variant="outline" className="bg-blue-50 text-blue-700">Scheduled</Badge>;
    if (now > expiry) return <Badge variant="secondary">Expired</Badge>;
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) return <Badge variant="secondary">Fully Used</Badge>;
    
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Coupon Management</h1>
          <p className="text-hotel-black/60">Create promotional codes and discounts</p>
        </div>
        <Button onClick={() => { setEditingCoupon(null); setIsOpen(true); }} className="bg-hotel-gold hover:bg-yellow-500 text-hotel-black flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Coupon
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Code</th>
              <th className="px-4 py-3 font-medium text-gray-500">Discount</th>
              <th className="px-4 py-3 font-medium text-gray-500">Validity</th>
              <th className="px-4 py-3 font-medium text-gray-500">Usage</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : coupons?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No coupons found</td></tr>
            ) : (
              coupons?.map((coupon: any) => (
                <tr key={coupon._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-bold flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-hotel-gold" />
                      {coupon.code}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={coupon.description}>{coupon.description}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                    {coupon.maxDiscount && coupon.discountType === "PERCENTAGE" && <div className="text-xs text-gray-500 font-normal">Up to ₹{coupon.maxDiscount}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div>{format(new Date(coupon.startDate), 'MMM d, yyyy')}</div>
                    <div>to {format(new Date(coupon.expiryDate), 'MMM d, yyyy')}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {coupon.timesUsed} {coupon.usageLimit && `/ ${coupon.usageLimit}`}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(coupon)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditingCoupon(coupon); setIsOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Delete" className="text-red-500" onClick={() => {
                        if (confirm("Delete this coupon?")) deleteMutation.mutate(coupon._id);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Coupon Code</label>
                <Input name="code" required minLength={3} defaultValue={editingCoupon?.code} className="uppercase font-mono" placeholder="SUMMER20" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select name="isActive" className="w-full border rounded-md p-2 text-sm" defaultValue={editingCoupon?.isActive === false ? "false" : "true"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input name="description" required minLength={5} defaultValue={editingCoupon?.description} placeholder="Summer special discount" />
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Type</label>
                <select name="discountType" className="w-full border rounded-md p-2 text-sm" defaultValue={editingCoupon?.discountType || "PERCENTAGE"}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Value</label>
                <Input name="discountValue" type="number" required min="1" step="0.01" defaultValue={editingCoupon?.discountValue} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Discount (₹) <span className="text-gray-400 font-normal">(Optional)</span></label>
                <Input name="maxDiscount" type="number" min="1" defaultValue={editingCoupon?.maxDiscount} placeholder="e.g. 2000" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Booking Amount (₹) <span className="text-gray-400 font-normal">(Optional)</span></label>
                <Input name="minBookingAmount" type="number" min="1" defaultValue={editingCoupon?.minBookingAmount} placeholder="e.g. 5000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input name="startDate" type="datetime-local" required defaultValue={editingCoupon?.startDate ? new Date(editingCoupon.startDate).toISOString().slice(0,16) : ""} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry Date</label>
                <Input name="expiryDate" type="datetime-local" required defaultValue={editingCoupon?.expiryDate ? new Date(editingCoupon.expiryDate).toISOString().slice(0,16) : ""} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Usage Limit <span className="text-gray-400 font-normal">(Optional)</span></label>
                <Input name="usageLimit" type="number" min="1" defaultValue={editingCoupon?.usageLimit} placeholder="e.g. 100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit Per User</label>
                <Input name="perUserLimit" type="number" min="1" required defaultValue={editingCoupon?.perUserLimit || 1} />
              </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Coupon
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
