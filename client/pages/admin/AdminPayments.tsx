import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function AdminPayments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page, searchTerm, statusFilter],
    queryFn: async () => {
      let url = `/payments?page=${page}&limit=10`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      return res.data.data;
    }
  });

  const { data: viewData, isLoading: isLoadingView } = useQuery({
    queryKey: ["paymentDetails", viewingPayment?._id],
    queryFn: async () => {
      if (!viewingPayment) return null;
      const res = await api.get(`/payments/detail/${viewingPayment._id}`);
      return res.data.data;
    },
    enabled: !!viewingPayment
  });

  const handleView = (payment: any) => {
    setViewingPayment(payment);
    setIsViewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case "PENDING": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "FAILED": return <Badge variant="destructive">Failed</Badge>;
      case "REFUNDED": return <Badge variant="secondary">Refunded</Badge>;
      case "PARTIALLY_REFUNDED": return <Badge variant="secondary">Partially Refunded</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">Payment Management</h1>
        <p className="text-hotel-black/60">Monitor transactions, revenue, and payment statuses</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Collected</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{data?.stats?.totalCollected || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Pending Amount</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">₹{data?.stats?.pendingAmount || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Refunded</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">₹{data?.stats?.refundedAmount || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Success / Failed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            <span className="text-green-600">{data?.stats?.successfulCount || 0}</span> / <span className="text-red-500">{data?.stats?.failedCount || 0}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search by booking reference, email..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="border rounded-md px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Transaction ID</th>
              <th className="px-4 py-3 font-medium text-gray-500">Booking Ref</th>
              <th className="px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 font-medium text-gray-500">Method</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.payments?.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No payments found</td></tr>
            ) : (
              data?.payments?.map((payment: any) => (
                <tr key={payment._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {payment.razorpayPaymentId || payment.transactionId || payment._id.substring(0, 10)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {payment.booking?.bookingReference || 'N/A'}
                  </td>
                  <td className="px-4 py-3 font-bold">
                    ₹{payment.amount}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{payment.method}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleView(payment)}>
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

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
          {isLoadingView ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>
          ) : viewData && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="font-bold text-2xl">₹{viewData.amount}</h3>
                  <p className="text-gray-500 text-sm">Processed on {format(new Date(viewData.createdAt), 'MMMM d, yyyy HH:mm:ss')}</p>
                </div>
                {getStatusBadge(viewData.status)}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Transaction Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">System ID:</span> <span className="font-mono">{viewData._id}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Method:</span> <span>{viewData.method}</span></div>
                    {viewData.razorpayOrderId && (
                      <div className="flex justify-between"><span className="text-gray-500">Razorpay Order:</span> <span className="font-mono">{viewData.razorpayOrderId}</span></div>
                    )}
                    {viewData.razorpayPaymentId && (
                      <div className="flex justify-between"><span className="text-gray-500">Razorpay Payment ID:</span> <span className="font-mono">{viewData.razorpayPaymentId}</span></div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Booking Information</h4>
                  {viewData.booking ? (
                    <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg border">
                      <div className="flex justify-between"><span className="text-gray-500">Booking Ref:</span> <span className="font-bold">{viewData.booking.bookingReference}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Guest:</span> <span>{viewData.booking.guestDetails?.firstName} {viewData.booking.guestDetails?.lastName}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Email:</span> <span>{viewData.booking.guestDetails?.email}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Phone:</span> <span>{viewData.booking.guestDetails?.phone}</span></div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Booking information unavailable</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
