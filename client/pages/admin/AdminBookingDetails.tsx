import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { format, differenceInDays } from "date-fns";
import { ArrowLeft, Loader2, Calendar, User, CreditCard, Building, Edit, LogIn, LogOut, Ban, Check, ShieldCheck, MapPin, Briefcase, FileImage } from "lucide-react";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function AdminBookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adminBooking", id],
    queryFn: () => apiFetch(`/api/admin/bookings/${id}`, user?.token),
    enabled: !!user && !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiFetch(`/api/admin/bookings/${id}/status`, user?.token, "PATCH", { status }),
    onSuccess: (resData) => {
      if (resData.success) {
        toast({ title: "Status Updated", description: "Booking status has been updated." });
        queryClient.invalidateQueries({ queryKey: ["adminBooking", id] });
        setIsUpdatingStatus(false);
      } else {
        toast({ title: "Error", description: resData.message, variant: "destructive" });
      }
    },
  });
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/bookings/${id}/cancel`, user?.token, "POST", { reason: cancelReason }),
    onSuccess: (resData) => {
      if (resData.success) {
        toast({ title: "Booking Cancelled", description: "Booking has been cancelled by admin." });
        queryClient.invalidateQueries({ queryKey: ["adminBooking", id] });
        setShowCancelModal(false);
        setCancelReason("");
      } else {
        toast({ title: "Error", description: resData.message, variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  const booking = data?.data;
  if (!booking) return <div className="p-6">Booking not found.</div>;

  const nights = differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/bookings" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm">
            <ArrowLeft size={16} /> Back to Bookings
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="text-2xl font-semibold text-gray-900">Booking {booking.bookingReference}</h1>
        </div>
        <div className="flex items-center gap-3">
          {booking.status !== "CANCELLED" && booking.status !== "CHECKED_OUT" && (
            <button 
              onClick={() => setShowCancelModal(true)}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin"/> : <Ban size={16}/>}
              Cancel Booking
            </button>
          )}
          {booking.status === "CONFIRMED" && (
             <Link to="/admin/check-in" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-2">
               <LogIn size={16}/> Check In
             </Link>
          )}
          {booking.status === "CHECKED_IN" && (
             <Link to="/admin/check-out" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors flex items-center gap-2">
               <LogOut size={16}/> Check Out
             </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Guest Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
               <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2"><User size={18} className="text-indigo-500"/> Guest Details</h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Name</p>
                <p className="text-gray-900">{booking.guestDetails.firstName} {booking.guestDetails.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Contact</p>
                <p className="text-gray-900">{booking.guestDetails.email}</p>
                <p className="text-gray-600 text-sm">{booking.guestDetails.phone}</p>
              </div>
              {booking.customer && (
                <div className="col-span-2 mt-2 p-3 bg-indigo-50 rounded text-sm text-indigo-800 flex items-center gap-2">
                   <User size={16}/> Registered Customer Account Linked
                </div>
              )}
            </div>

            {/* Registration Details (Added for Walk-in / Full Registration flow) */}
            <div className="border-t border-gray-100 p-6 bg-gray-50/50">
               <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><ShieldCheck size={14}/> Identity & Registration Data</h4>
               
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">ID Type</p>
                   <p className="text-sm font-medium">{booking.guestDetails.idType || "—"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">ID Number</p>
                   <p className="text-sm font-mono">{booking.guestDetails.idNumber || "—"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Nationality</p>
                   <p className="text-sm">{booking.guestDetails.nationality || "Indian"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Date of Birth</p>
                   <p className="text-sm">{booking.guestDetails.dateOfBirth ? format(new Date(booking.guestDetails.dateOfBirth), "PP") : "—"}</p>
                 </div>
                 <div className="col-span-2">
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Full Address</p>
                   <p className="text-sm text-gray-700">{booking.guestDetails.address || "—"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Organization</p>
                   <p className="text-sm">{booking.guestDetails.organization || "—"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Purpose of Visit</p>
                   <p className="text-sm">{booking.guestDetails.purposeOfVisit || "—"}</p>
                 </div>
               </div>

               {booking.foreignGuestDetails && (
                 <div className="mb-6 p-4 border border-orange-200 bg-orange-50 rounded-lg">
                   <h5 className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-3">Foreign Guest (Form C) Data</h5>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                     <div><p className="text-[10px] uppercase text-orange-600 font-bold mb-1">Passport No.</p><p className="text-sm font-mono text-orange-900">{booking.foreignGuestDetails.passportNumber || "—"}</p></div>
                     <div><p className="text-[10px] uppercase text-orange-600 font-bold mb-1">Issue Date</p><p className="text-sm text-orange-900">{booking.foreignGuestDetails.passportIssueDate ? format(new Date(booking.foreignGuestDetails.passportIssueDate), "PP") : "—"}</p></div>
                     <div><p className="text-[10px] uppercase text-orange-600 font-bold mb-1">Expiry Date</p><p className="text-sm text-orange-900">{booking.foreignGuestDetails.passportExpiryDate ? format(new Date(booking.foreignGuestDetails.passportExpiryDate), "PP") : "—"}</p></div>
                     <div><p className="text-[10px] uppercase text-orange-600 font-bold mb-1">Visa No.</p><p className="text-sm font-mono text-orange-900">{booking.foreignGuestDetails.visaNumber || "—"}</p></div>
                   </div>
                 </div>
               )}

               {booking.guestDetails.idProofImages && booking.guestDetails.idProofImages.length > 0 && (
                 <div>
                   <p className="text-[10px] uppercase text-gray-500 font-bold mb-2 flex items-center gap-1"><FileImage size={12}/> ID Proof Documents</p>
                   <div className="flex gap-3 overflow-x-auto pb-2">
                     {booking.guestDetails.idProofImages.map((img: string, idx: number) => (
                       <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded border border-gray-200 overflow-hidden hover:border-indigo-500 transition shadow-sm">
                         {img.startsWith("data:image") || img.startsWith("http") ? (
                           <img src={img} alt="ID Proof" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">Doc</div>
                         )}
                       </a>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          </div>

          {/* Stay Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
               <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2"><Calendar size={18} className="text-indigo-500"/> Stay Information</h3>
            </div>
            <div className="p-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Dates</p>
                    <p className="text-gray-900">{format(new Date(booking.checkInDate), "MMM dd, yyyy")} → {format(new Date(booking.checkOutDate), "MMM dd, yyyy")}</p>
                    <p className="text-gray-500 text-sm">{nights} Night(s)</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Guests</p>
                    <p className="text-gray-900">{booking.adults} Adult(s), {booking.children} Child(ren)</p>
                  </div>
               </div>
               
               <div className="pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Category</p>
                    <p className="text-gray-900 font-medium">{booking.roomCategory?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Assigned Room</p>
                    {booking.assignedRoom ? (
                      <p className="text-gray-900 flex items-center gap-2">
                        <Building size={16} className="text-gray-400"/> Room {booking.assignedRoom.roomNumber} (Floor {booking.assignedRoom.floor})
                      </p>
                    ) : (
                      <p className="text-amber-600 text-sm italic">Not assigned yet</p>
                    )}
                  </div>
               </div>
               
               {booking.specialRequests && (
                  <div className="pt-6 mt-6 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-500 mb-2">Special Requests</p>
                    <p className="text-gray-800 text-sm p-3 bg-gray-50 rounded">{booking.specialRequests}</p>
                  </div>
               )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           {/* Status Card */}
           <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Status</h3>
                  <button onClick={() => setIsUpdatingStatus(!isUpdatingStatus)} className="text-indigo-600 hover:text-indigo-800 p-1">
                    <Edit size={16} />
                  </button>
                </div>
                
                {isUpdatingStatus ? (
                  <div className="space-y-3">
                    <select
                      className="w-full border-gray-300 rounded shadow-sm text-sm"
                      value={newStatus || booking.status}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="NO_SHOW">NO_SHOW</option>
                    </select>
                    <p className="text-[11px] text-gray-400">
                      CHECKED_IN and CHECKED_OUT can only be set via the Check In / Check Out actions above — they assign a room and settle the folio, which this quick edit can't do safely.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => updateStatusMutation.mutate(newStatus)} className="flex-1 bg-indigo-600 text-white text-xs py-2 rounded hover:bg-indigo-700">Update</button>
                      <button onClick={() => setIsUpdatingStatus(false)} className="flex-1 bg-gray-100 text-gray-700 text-xs py-2 rounded hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full 
                    ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : ''}
                    ${booking.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : ''}
                    ${booking.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-800' : ''}
                    ${booking.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-800' : ''}
                    ${booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {booking.status}
                  </span>
                )}
              </div>
           </div>

           {/* Payment Card */}
           <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             <div className="border-b border-gray-200 px-6 py-4">
               <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2"><CreditCard size={18} className="text-indigo-500"/> Payment</h3>
            </div>
            <div className="p-6 space-y-4">
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">Room Charges</span>
                 <span className="text-gray-900">₹{(booking.totalAmount - booking.taxAmount).toLocaleString("en-IN")}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500">Tax Amount</span>
                 <span className="text-gray-900">₹{booking.taxAmount.toLocaleString("en-IN")}</span>
               </div>
               <div className="pt-3 border-t border-gray-100 flex justify-between items-center font-medium">
                 <span className="text-gray-900">Total</span>
                 <span className="text-gray-900 text-lg">₹{booking.totalAmount.toLocaleString("en-IN")}</span>
               </div>
               
               <div className="mt-4 pt-4 border-t border-gray-100">
                 <div className="flex justify-between items-center text-sm mb-2">
                   <span className="text-gray-500">Payment Status</span>
                   <span className={`font-semibold ${booking.paymentStatus === 'PAID' ? 'text-green-600' : 'text-amber-600'}`}>
                     {booking.paymentStatus}
                   </span>
                 </div>
                 <div className="flex justify-between items-center text-sm mb-2">
                   <span className="text-gray-500">Paid Amount</span>
                   <span className="text-gray-900">₹{booking.paidAmount?.toLocaleString("en-IN") || 0}</span>
                 </div>
                 {booking.status === "CANCELLED" && (
                   <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-red-500 font-medium">Cancellation Penalty</span>
                       <span className="text-red-600 font-semibold">₹{booking.cancellationPenalty?.toLocaleString("en-IN") || 0}</span>
                     </div>
                     {booking.cancellationReason && (
                       <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                         <span className="font-semibold text-gray-700">Reason:</span> {booking.cancellationReason}
                       </div>
                     )}
                   </div>
                 )}
               </div>
            </div>
           </div>
        </div>
      </div>

      {/* Folio Ledger Section */}
      <FolioSection bookingId={id as string} userToken={user?.token} />

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cancel Booking</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to cancel this booking? If the reason is an emergency, the system may process a refund automatically.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Reason</label>
              <textarea 
                className="w-full border border-gray-300 rounded shadow-sm text-sm p-2" 
                rows={3} 
                value={cancelReason} 
                onChange={(e) => setCancelReason(e.target.value)} 
                placeholder="e.g. Guest requested, Urgent emergency, etc."
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Close</button>
              <button 
                onClick={() => cancelMutation.mutate()} 
                disabled={cancelMutation.isPending || cancelReason.trim().length === 0} 
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolioSection({ bookingId, userToken }: { bookingId: string; userToken?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPostModal, setShowPostModal] = useState(false);
  const [lineType, setLineType] = useState("ROOM_CHARGE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [applyTax, setApplyTax] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["folio", bookingId],
    queryFn: () => apiFetch(`/api/folios/booking/${bookingId}`, userToken),
    enabled: !!bookingId,
  });

  const folioData = data?.data;
  const folio = folioData?.folio;
  const lines = folioData?.lines || [];

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/folios/${folio._id}/charges`, userToken, "POST", {
        lineType,
        description,
        amount: parseFloat(amount),
        applyTax,
      });
      if (res.success) {
        toast({ title: "Charge Posted", description: res.message });
        setShowPostModal(false);
        setDescription("");
        setAmount("");
        queryClient.invalidateQueries({ queryKey: ["folio", bookingId] });
      } else {
        toast({ title: "Error Posting Charge", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-4 text-center text-xs text-gray-500">Loading Folio Ledger...</div>;
  if (!folio) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200 text-center space-y-2">
        <p className="text-gray-700 font-medium">No active folio ledger for this stay yet.</p>
        <p className="text-xs text-gray-500">Folios are automatically created upon guest check-in.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm space-y-4 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
            Stay Folio Ledger <span className="text-xs font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-sans">{folio.status}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Append-only financial audit trail for this reservation stay.</p>
        </div>
        {folio.status === "OPEN" && (
          <button
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            + Post Charge to Folio
          </button>
        )}
      </div>

      {/* Live Financial Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-xl text-center text-xs font-medium">
        <div>
          <span className="text-gray-500 block">Total Charges</span>
          <span className="text-sm font-bold text-gray-900">₹{folio.totalCharges || 0}</span>
        </div>
        <div>
          <span className="text-gray-500 block">CGST + SGST</span>
          <span className="text-sm font-bold text-gray-900">₹{folio.totalTax || 0}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Advances Adjusted</span>
          <span className="text-sm font-bold text-amber-700">₹{folio.totalAdvanceAdjusted || 0}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Payments Received</span>
          <span className="text-sm font-bold text-emerald-700">₹{folio.totalPaid || 0}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Current Balance</span>
          <span className={`text-sm font-bold ${folio.balance > 0 ? "text-red-600" : "text-emerald-700"}`}>
            ₹{folio.balance}
          </span>
        </div>
      </div>

      {/* Folio Line Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
            <tr>
              <th className="p-2.5 rounded-l">Date & Time</th>
              <th className="p-2.5">Line Type</th>
              <th className="p-2.5">Description</th>
              <th className="p-2.5 text-right">Debit (Charge)</th>
              <th className="p-2.5 text-right rounded-r">Credit (Paid)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">No folio transactions recorded.</td></tr>
            ) : (
              lines.map((l: any) => (
                <tr key={l._id} className="hover:bg-gray-50">
                  <td className="p-2.5 text-gray-500 font-mono">{format(new Date(l.date), "MMM dd, hh:mm a")}</td>
                  <td className="p-2.5 font-bold text-gray-700">{l.lineType}</td>
                  <td className="p-2.5 text-gray-900 font-medium">{l.description}</td>
                  <td className="p-2.5 text-right font-semibold text-red-600">
                    {l.direction === "DEBIT" ? `₹${l.amount}` : "—"}
                  </td>
                  <td className="p-2.5 text-right font-semibold text-emerald-600">
                    {l.direction === "CREDIT" ? `₹${l.amount}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Post Charge Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePostCharge} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h4 className="font-bold text-gray-900 text-base border-b pb-2">Post Charge / Service Fee to Folio</h4>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Line Category</label>
              <select
                value={lineType}
                onChange={(e) => setLineType(e.target.value)}
                className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ROOM_CHARGE">ROOM_CHARGE — Nightly Tariff</option>
                <option value="RESTAURANT">RESTAURANT — Room Service / KOT</option>
                <option value="LAUNDRY">LAUNDRY — Express Laundry Service</option>
                <option value="MINIBAR">MINIBAR — Minibar Refreshments</option>
                <option value="ADDON">ADDON — Spa / Activity / Tour</option>
                <option value="DISCOUNT">DISCOUNT — Managerial Discount</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Breakfast Buffet / Laundry 2 shirts"
                className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 750"
                className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="taxChk"
                checked={applyTax}
                onChange={(e) => setApplyTax(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="taxChk" className="text-xs text-gray-700">Auto-calculate CGST + SGST (9% + 9%) split</label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="flex-1 py-2 border rounded text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Confirm & Post"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


