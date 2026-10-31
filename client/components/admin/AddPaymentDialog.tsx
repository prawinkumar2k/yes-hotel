import { useEffect, useState } from "react";
import { CreditCard, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Receive a full or part payment for one booking (or all rooms of a group).
 * The guest can pay the rest on another day. On success every screen that shows
 * bookings, bills or payments is refreshed.
 */
export default function AddPaymentDialog({
  open,
  onClose,
  bookingIds,
  guestName,
  roomCount = 1,
  total,
  paid,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  bookingIds: string[];
  guestName: string;
  roomCount?: number;
  total: number;
  paid: number;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const due = Math.round((total - paid) * 100) / 100;
  const [form, setForm] = useState({ amount: "", method: "CASH", reference: "", notes: "", key: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ amount: String(Math.max(0, due)), method: "CASH", reference: "", notes: "", key: newKey() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) return void toast({ title: "Enter the amount received", variant: "destructive" });
    if (amount > due + 0.001) return void toast({ title: "Amount is more than the balance due", description: `Only ${inr(due)} is due.`, variant: "destructive" });
    if ((form.method === "CARD" || form.method === "UPI") && !form.reference.trim()) {
      return void toast({ title: `Enter the ${form.method} reference`, description: "Approval code / UTR number", variant: "destructive" });
    }
    setBusy(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch("/api/reception/bookings/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ bookingIds, amount, method: form.method, reference: form.reference.trim() || undefined, notes: form.notes.trim() || undefined, clientRequestId: form.key }),
      });
      const json = await res.json();
      if (!json.success) return void toast({ title: "Could not record payment", description: json.message, variant: "destructive" });
      const left = Math.round((due - amount) * 100) / 100;
      toast({
        title: json.duplicate ? "Already recorded" : "Payment received",
        description: left > 0 ? `${json.message}. Balance still due ${inr(left)}.` : `${json.message}. Bill is paid in full.`,
      });
      onClose();
      queryClient.invalidateQueries(); // bookings, folios, billing queue, front desk, reports
      onDone?.();
      const pid = json.data?.payment?._id;
      if (pid) window.open(`/admin/payments/${pid}/receipt`, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4 text-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="text-emerald-600" size={20} />
            <h3 className="font-serif text-lg font-bold">Add Payment</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
        </div>
        <div className="text-sm">
          <div className="font-semibold">{guestName}{roomCount > 1 ? ` · ${roomCount} rooms` : ""}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-gray-50 border rounded-lg p-2">Total<div className="font-bold text-sm">{inr(total)}</div></div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">Paid so far<div className="font-bold text-sm text-emerald-700">{inr(paid)}</div></div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">Balance due<div className="font-bold text-sm text-red-700">{inr(due)}</div></div>
          </div>
        </div>
        <label className="block text-xs font-semibold text-gray-600">Amount received now (part payment is fine; the rest can be paid on another day)
          <input type="number" min="0.01" step="0.01" max={due} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </label>
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-1">Payment type</div>
          <div className="grid grid-cols-3 gap-2">
            {["CASH", "UPI", "CARD"].map((m) => (
              <button key={m} type="button" onClick={() => setForm({ ...form, method: m })} className={cn("py-2 rounded-lg text-xs font-bold border", form.method === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300")}>{m}</button>
            ))}
          </div>
        </div>
        {(form.method === "UPI" || form.method === "CARD") && (
          <label className="block text-xs font-semibold text-gray-600">{form.method === "UPI" ? "UPI reference / UTR" : "Card approval code"}
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
        )}
        <label className="block text-xs font-semibold text-gray-600">Note (optional)
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">{busy ? "Saving..." : "Receive Payment"}</button>
        </div>
      </div>
    </div>
  );
}
