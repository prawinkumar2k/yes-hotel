import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { LogOut, Search, User, Calendar, Loader2, ArrowLeft, LogIn, Receipt, CreditCard, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { getStoredAuthToken } from "../../lib/authStorage";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const authToken = token || getStoredAuthToken();
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function AdminCheckOut() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>("");
  const [advanceToAdjust, setAdvanceToAdjust] = useState<number>(0);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["checkOutBookings", search],
    queryFn: () =>
      apiFetch(
        `/api/admin/bookings?status=CHECKED_IN&search=${encodeURIComponent(search)}`,
        user?.token
      ),
  });

  // Query checkout preview for selected booking
  const { data: previewData, isLoading: isLoadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ["checkoutPreview", selectedBooking?._id],
    queryFn: () => apiFetch(`/api/bookings/${selectedBooking?._id}/checkout-preview`, user?.token),
    enabled: !!selectedBooking?._id,
  });

  const preview = previewData?.data;
  const balanceDue = preview?.summary?.balanceDue || 0;
  const refundDue = preview?.summary?.refundDue || 0;
  const availableAdvances = preview?.availableAdvances || [];

  // Auto-fill payment amount if balance is due
  useEffect(() => {
    if (preview) {
      setPaymentAmountInput(balanceDue > 0 ? String(balanceDue) : "0");
      if (availableAdvances.length > 0 && balanceDue > 0) {
        const firstAdv = availableAdvances[0];
        const adjustMax = Math.min(firstAdv.remainingBalance, balanceDue);
        setSelectedAdvanceId(firstAdv._id);
        setAdvanceToAdjust(adjustMax);
        setPaymentAmountInput(String(Math.max(0, balanceDue - adjustMax)));
      } else {
        setSelectedAdvanceId("");
        setAdvanceToAdjust(0);
      }
    }
  }, [previewData]);

  const checkOutMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch(`/api/bookings/${selectedBooking?._id}/check-out`, user?.token, "POST", payload),
    onSuccess: (data) => {
      if (data.success) {
        setLastInvoice(data.invoiceNumber || "SETTLED");
        toast({
          title: "✅ Check-Out Completed",
          description: `${selectedBooking?.guestDetails.firstName} has been checked out. Official Invoice #${data.invoiceNumber || "N/A"} issued.`,
        });
        setSelectedBooking(null);
        setConfirmed(false);
        queryClient.invalidateQueries({ queryKey: ["checkOutBookings"] });
        queryClient.invalidateQueries({ queryKey: ["checkInBookings"] });
      } else {
        toast({ title: "Check-Out Failed", description: data.message, variant: "destructive" });
      }
    },
  });

  const handleProcessCheckout = () => {
    const payload: any = {
      notes: checkoutNotes,
      paymentMethod,
    };

    if (advanceToAdjust > 0) {
      payload.advanceAdjustmentAmount = advanceToAdjust;
      if (selectedAdvanceId) payload.advancePaymentId = selectedAdvanceId;
    }

    const payAmt = Number(paymentAmountInput) || 0;
    if (payAmt > 0) {
      payload.paymentAmount = payAmt;
    }

    if (refundDue > 0) {
      payload.refundAmount = refundDue;
    }

    checkOutMutation.mutate(payload);
  };

  const bookings = bookingsData?.data?.bookings ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="font-semibold text-gray-900 flex items-center gap-2">
            <LogOut size={18} className="text-red-600" /> Check-Out 2.0 & Folio Settlement
          </h1>
        </div>
        <Link to="/admin/check-in" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <LogIn size={16} /> Go to Check-In →
        </Link>
      </header>

      {lastInvoice && (
        <div className="max-w-6xl mx-auto mt-4 px-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span>Latest Checkout settled successfully. GST Invoice Number: <strong>{lastInvoice}</strong></span>
            </div>
            <button onClick={() => setLastInvoice(null)} className="text-xs bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-lg">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* In-House Guests List */}
          <div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Currently Checked-In Guests ({bookings.length})</p>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search guest name, room, or booking reference..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[600px]">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No guests currently in-house matching search.</div>
                ) : (
                  bookings.map((b: any) => (
                    <button
                      key={b._id}
                      onClick={() => { setSelectedBooking(b); setConfirmed(false); }}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedBooking?._id === b._id ? "bg-red-50/70 border-l-4 border-l-red-600" : ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{b.guestDetails?.firstName} {b.guestDetails?.lastName}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">#{b.bookingReference}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">{b.checkOutDate ? format(new Date(b.checkOutDate), "MMM dd") : "—"} checkout</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-full">IN-HOUSE</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>{b.roomCategory?.name || "Room"} · <strong>Room {b.assignedRoom?.roomNumber ?? "N/A"}</strong></span>
                        <span className="font-medium text-gray-900">Total: ₹{b.totalAmount?.toLocaleString("en-IN")}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Checkout 2.0 Settlement Panel */}
          <div>
            {selectedBooking ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
                  <h2 className="font-semibold text-red-900 flex items-center gap-2">
                    <Receipt size={18} /> Folio & Tax Invoice Settlement
                  </h2>
                  <span className="text-xs font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">
                    Room {selectedBooking.assignedRoom?.roomNumber || "N/A"}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Guest Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50/70 p-3 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Guest</p>
                      <p className="font-bold text-gray-900">{selectedBooking.guestDetails?.firstName} {selectedBooking.guestDetails?.lastName}</p>
                      <p className="text-xs text-gray-500">{selectedBooking.guestDetails?.email}</p>
                      <p className="text-xs text-gray-500">{selectedBooking.guestDetails?.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Stay Period</p>
                      <p className="text-xs text-gray-800">
                        {selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), "MMM dd") : ""} → {selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), "MMM dd, yyyy") : ""}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{selectedBooking.roomCategory?.name} (Floor {selectedBooking.assignedRoom?.floor || "—"})</p>
                    </div>
                  </div>

                  {/* Folio Charges Breakdown */}
                  {isLoadingPreview ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border border-gray-200 rounded-lg p-4 space-y-2 text-sm bg-white">
                        <div className="flex justify-between font-medium text-gray-700">
                          <span>Gross Room & Service Charges:</span>
                          <span>₹{(preview?.summary?.totalCharges || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Discounts Applied:</span>
                          <span>-₹{(preview?.summary?.totalDiscounts || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>CGST (9%):</span>
                          <span>₹{(preview?.summary?.cgst || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>SGST (9%):</span>
                          <span>₹{(preview?.summary?.sgst || 0).toLocaleString("en-IN")}</span>
                        </div>
                        {preview?.summary?.igst > 0 && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>IGST (18%):</span>
                            <span>₹{preview.summary.igst.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
                          <span>Total Invoice With Tax:</span>
                          <span>₹{((preview?.summary?.totalCharges || 0) + (preview?.summary?.totalTax || 0) - (preview?.summary?.totalDiscounts || 0)).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-600 font-medium">
                          <span>Total Paid / Advance Adjusted:</span>
                          <span>₹{((preview?.summary?.totalPaid || 0) + (preview?.summary?.totalAdvanceAdjusted || 0)).toLocaleString("en-IN")}</span>
                        </div>
                        <div className={`flex justify-between font-bold text-sm pt-2 border-t border-gray-200 ${balanceDue > 0 ? "text-red-600" : refundDue > 0 ? "text-amber-600" : "text-emerald-700"}`}>
                          <span>{balanceDue > 0 ? "Outstanding Balance Due:" : refundDue > 0 ? "Refund Due to Guest:" : "Folio Status:"}</span>
                          <span>{balanceDue > 0 ? `₹${balanceDue.toLocaleString("en-IN")}` : refundDue > 0 ? `₹${refundDue.toLocaleString("en-IN")}` : "Fully Settled (₹0.00)"}</span>
                        </div>
                      </div>

                      {/* Advance Payment Adjustment Option */}
                      {availableAdvances.length > 0 && balanceDue > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                          <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                            <Sparkles size={14} /> Available Advance Balance: ₹{preview.totalAdvanceAvailable}
                          </p>
                          <div className="flex items-center gap-3">
                            <label className="text-xs text-gray-700">Adjust from Advance:</label>
                            <input
                              type="number"
                              min="0"
                              max={Math.min(preview.totalAdvanceAvailable, balanceDue)}
                              value={advanceToAdjust}
                              onChange={e => {
                                const v = Math.min(Number(e.target.value) || 0, preview.totalAdvanceAvailable);
                                setAdvanceToAdjust(v);
                                setPaymentAmountInput(String(Math.max(0, balanceDue - v)));
                              }}
                              className="w-28 px-2 py-1 border border-amber-300 rounded text-sm bg-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Payment Collection Inputs if Balance Due */}
                      {balanceDue > 0 && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1">
                            <CreditCard size={14} /> Collect Payment At Checkout
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">Payment Method</label>
                              <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm bg-white"
                              >
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                                <option value="CARD">Credit / Debit Card</option>
                                <option value="BANK_TRANSFER">NEFT / Bank Transfer</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">Amount to Collect</label>
                              <input
                                type="number"
                                value={paymentAmountInput}
                                onChange={e => setPaymentAmountInput(e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm font-bold bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Refund Processing Alert if Refund Due */}
                      {refundDue > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                          ℹ️ A refund of <strong>₹{refundDue.toLocaleString("en-IN")}</strong> will be recorded to settle the overpaid folio.
                        </div>
                      )}

                      {/* Notes input */}
                      <div>
                        <input
                          type="text"
                          placeholder="Optional settlement notes or reference..."
                          value={checkoutNotes}
                          onChange={e => setCheckoutNotes(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                    ⚠️ Completing check-out permanently closes the Folio, generates the official GST Tax Invoice, marks Room {selectedBooking.assignedRoom?.roomNumber ?? ""} as <strong>DIRTY</strong>, and dispatches a departure cleaning task.
                  </div>

                  {/* Confirmation checkbox */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="w-4 h-4 accent-red-600"
                    />
                    <span className="text-gray-700 font-medium">I verify that the charges are accurate and all keys have been returned.</span>
                  </label>

                  <button
                    disabled={!confirmed || checkOutMutation.isPending}
                    onClick={handleProcessCheckout}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  >
                    {checkOutMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Complete Checkout & Issue Tax Invoice
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-full min-h-[400px] text-center text-gray-400 shadow-sm">
                <div>
                  <User size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">Select an in-house guest from the list to preview folio and finalize checkout.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
