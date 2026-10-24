import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const refundable = (p: any) => Math.max(0, Math.round(((Number(p.amount) || 0) - (Number(p.refundedAmount) || 0)) * 100) / 100);

/**
 * Refund all or part of a payment. Type a booking number (or arrive with one already filled in), the payment is found,
 * its refundable amount is filled in, and the refund goes back to where the money came from.
 * Used on the booking page (booking number fixed) and on the Refunds page.
 */
export default function RefundDialog({ open, onOpenChange, bookingRef: initialRef = "", onDone }: { open: boolean; onOpenChange: (o: boolean) => void; bookingRef?: string; onDone?: () => void }) {
  const { toast } = useToast();
  const [bookingRef, setBookingRef] = useState(initialRef);
  const [found, setFound] = useState<any[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const findPayments = async (ref: string) => {
    if (!ref.trim()) return;
    setFinding(true);
    try {
      const res = await api.get(`/payments?search=${encodeURIComponent(ref.trim())}&limit=20`);
      const list = (res.data?.data?.payments ?? []).filter((p: any) => ["COMPLETED", "PARTIALLY_REFUNDED"].includes(p.status) && refundable(p) > 0);
      setFound(list);
      if (list.length === 1) { setPaymentId(list[0]._id); setAmount(String(refundable(list[0]))); }
    } catch (e: any) {
      toast({ title: "Could not look up payments", description: e?.response?.data?.message || e.message, variant: "destructive" });
    } finally {
      setFinding(false);
    }
  };

  // Opening the box with a booking number finds its payment straight away.
  useEffect(() => {
    if (open) {
      setBookingRef(initialRef);
      setFound(null); setPaymentId(""); setAmount(""); setReason("");
      if (initialRef) findPayments(initialRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRef]);

  const refund = useMutation({
    mutationFn: async () => (await api.post("/refunds/initiate", { paymentId, amount: Number(amount), reason })).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["adminBooking"] });
      toast({ title: "Refund started", description: data.message || "The refund was sent to the payment gateway" });
      onOpenChange(false);
      onDone?.();
    },
    onError: (error: any) => toast({ title: "Refund failed", description: error.response?.data?.message || "Could not start the refund", variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentId) { toast({ title: "Choose the payment to refund", variant: "destructive" }); return; }
    if (confirm(`Refund ₹${Number(amount).toLocaleString("en-IN")}? This cannot be undone and goes back to the guest's card, UPI or bank.`)) refund.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2"><RefreshCcw className="w-5 h-5" /> Refund a payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Booking number</label>
            <div className="flex gap-2">
              <Input value={bookingRef} readOnly={!!initialRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="e.g. YH-1024-001" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findPayments(bookingRef); } }} />
              {!initialRef && <Button type="button" variant="outline" onClick={() => findPayments(bookingRef)} disabled={finding}>{finding ? "Finding…" : "Find payment"}</Button>}
            </div>
            {finding && <p className="text-xs text-gray-500">Looking up the payment…</p>}
            {found && found.length === 0 && <p className="text-xs text-red-600">No refundable payment found for this booking (nothing paid, or already fully refunded).</p>}
            {found && found.length > 0 && (
              <div className="space-y-1">
                {found.map((p: any) => (
                  <label key={p._id} className={`flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer ${paymentId === p._id ? "border-black bg-gray-50" : ""}`}>
                    <input type="radio" name="refund-payment" checked={paymentId === p._id} onChange={() => { setPaymentId(p._id); setAmount(String(refundable(p))); }} />
                    <span>₹{Number(p.amount).toLocaleString("en-IN")} · {p.method}{p.razorpayPaymentId ? ` · ${p.razorpayPaymentId}` : ""} · refundable ₹{refundable(p).toLocaleString("en-IN")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Refund amount (₹)</label>
            <Input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Full or part of the payment" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Guest cancelled; test booking" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={refund.isPending || !paymentId}>
              {refund.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirm refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
