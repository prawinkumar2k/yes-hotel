import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCcw, Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function AdminRefunds() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingRefund, setViewingRefund] = useState<any>(null);
  
  // For initiating refund manually
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["refunds", page, statusFilter],
    queryFn: async () => {
      let url = `/refunds?page=${page}&limit=10`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      return res.data.data;
    }
  });

  const initiateMutation = useMutation({
    mutationFn: async (data: { paymentId: string, amount: number, reason: string }) => {
      const res = await api.post("/refunds/initiate", data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast({ title: "Success", description: data.message || "Refund initiated successfully" });
      setIsInitiateOpen(false);
      setPaymentId("");
      setAmount("");
      setReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to initiate refund", variant: "destructive" });
    }
  });

  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm("Are you sure you want to initiate this refund? This action cannot be undone and will immediately attempt to reverse funds.")) {
      initiateMutation.mutate({
        paymentId,
        amount: Number(amount),
        reason
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case "PROCESSING": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Processing</Badge>;
      case "FAILED": return <Badge variant="destructive">Failed</Badge>;
      case "REQUESTED": return <Badge variant="secondary">Requested</Badge>;
      case "CANCELLED": return <Badge variant="outline" className="text-gray-500">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Refund Management</h1>
          <p className="text-hotel-black/60">Manage guest refunds and gateway reverse transactions</p>
        </div>
        <Button onClick={() => setIsInitiateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Initiate Manual Refund
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex gap-2">
          <select 
            className="border rounded-md px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Refund ID</th>
              <th className="px-4 py-3 font-medium text-gray-500">Booking Ref</th>
              <th className="px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Initiator</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.refunds?.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No refunds found</td></tr>
            ) : (
              data?.refunds?.map((refund: any) => (
                <tr key={refund._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {refund.razorpayRefundId || refund._id.substring(0, 10)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {refund.booking?.bookingReference || 'N/A'}
                  </td>
                  <td className="px-4 py-3 font-bold text-red-600">
                    -₹{refund.amount}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(refund.status)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {refund.initiatedBy?.firstName} {refund.initiatedBy?.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(refund.createdAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setViewingRefund(refund); setIsViewOpen(true); }}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {data?.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <Dialog open={isInitiateOpen} onOpenChange={setIsInitiateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <RefreshCcw className="w-5 h-5" /> Initiate Manual Refund
            </DialogTitle>
          </DialogHeader>
          <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm mb-4">
            <strong>Warning:</strong> Initiating a refund will immediately attempt to reverse funds from the gateway if applicable, and adjust booking paid amounts. This cannot be undone.
          </div>
          <form onSubmit={handleInitiateSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment ID (System ID)</label>
              <Input required value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="e.g. 64a1b2c3d4e5f60001234567" />
              <p className="text-xs text-gray-500">You can find this ID in the Payments module by clicking View.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Refund Amount (₹)</label>
              <Input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Full or partial amount" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Refund</label>
              <Input required minLength={5} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Guest cancelled booking 2 days prior" />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsInitiateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={initiateMutation.isPending}>
                {initiateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Refund
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund Details</DialogTitle></DialogHeader>
          {viewingRefund && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="font-bold text-2xl text-red-600">-₹{viewingRefund.amount}</h3>
                  <p className="text-gray-500 text-sm">Requested on {format(new Date(viewingRefund.createdAt), 'MMMM d, yyyy')}</p>
                </div>
                {getStatusBadge(viewingRefund.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex flex-col mb-4">
                  <span className="text-gray-500 mb-1">Reason:</span>
                  <span className="font-medium bg-gray-50 p-3 rounded border">{viewingRefund.reason}</span>
                </div>
                
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Booking Ref:</span> <span className="font-bold">{viewingRefund.booking?.bookingReference}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Guest Name:</span> <span>{viewingRefund.booking?.guestDetails?.firstName} {viewingRefund.booking?.guestDetails?.lastName}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">System Refund ID:</span> <span className="font-mono text-xs">{viewingRefund._id}</span></div>
                {viewingRefund.razorpayRefundId && (
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Razorpay Refund ID:</span> <span className="font-mono text-xs">{viewingRefund.razorpayRefundId}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">Initiated By:</span> <span>{viewingRefund.initiatedBy?.firstName} {viewingRefund.initiatedBy?.lastName}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
