/**
 * Guest self-service panels on a booking: pay the balance online, ask Reception to change
 * dates / guests, and review a completed stay. All rules (what's due, what can change, who
 * may review) are enforced by the server; these panels only show and submit.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Wallet, CalendarClock, Star, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { GoldButton, OutlineButton } from "@/components/hotel/HotelButtons";

declare global {
  interface Window { Razorpay: any }
}

async function api(url: string, token?: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (d: string | Date) => format(new Date(d), "yyyy-MM-dd");
const fieldCls = "w-full px-3 py-2 border border-hotel-black/15 bg-hotel-ivory/40 text-sm focus:outline-none focus:border-hotel-gold";

// ───────────────────────────────────────────── pay balance
export function BalancePanel({ booking }: { booking: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [part, setPart] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["myBalance", booking._id],
    queryFn: () => api(`/api/customer/bookings/${booking._id}/balance`, user?.token),
    enabled: !!user,
  });
  const due = data?.data?.amountDue ?? 0;
  const gateway = data?.data?.gateway;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["myBalance", booking._id] });
    qc.invalidateQueries({ queryKey: ["myBooking", booking._id] });
    qc.invalidateQueries({ queryKey: ["myBookings"] });
  };

  const pay = async () => {
    const amount = part ? Number(part) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > due)) {
      toast({ title: "Check the amount", description: `Enter up to ${inr(due)}`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const order = await api(`/api/customer/bookings/${booking._id}/pay/order`, user?.token, "POST", amount ? { amount } : {});
      if (!order.success) throw new Error(order.message);
      if (order.data.demo) {
        // Development only (no gateway keys): the server records it as a demo payment.
        const r = await api(`/api/customer/bookings/${booking._id}/pay/demo`, user?.token, "POST", { amount: order.data.amount });
        if (!r.success) throw new Error(r.message);
        toast({ title: "Payment received (demo)", description: `${inr(r.data.amount)} recorded against ${booking.bookingReference}` });
        setPart("");
        refresh();
        setBusy(false);
        return;
      }
      if (!(await loadRazorpayScript())) throw new Error("The payment window couldn't load. Check your connection.");
      const rz = new window.Razorpay({
        key: order.data.keyId,
        amount: Math.round(order.data.amount * 100),
        currency: order.data.currency,
        name: "YES Hotels",
        description: `Balance for ${booking.bookingReference}`,
        order_id: order.data.orderId,
        prefill: { name: `${booking.guestDetails?.firstName ?? ""} ${booking.guestDetails?.lastName ?? ""}`.trim(), email: booking.guestDetails?.email, contact: booking.guestDetails?.phone },
        theme: { color: "#C9A96E" },
        handler: async (resp: any) => {
          const v = await api("/api/customer/payments/verify", user?.token, "POST", { bookingId: booking._id, ...resp });
          if (v.success) {
            toast({ title: "Payment received", description: `${inr(v.data.amount)} — thank you` });
            setPart("");
            refresh();
          } else {
            toast({ title: "We couldn't confirm the payment", description: v.message, variant: "destructive" });
          }
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e: any) {
      toast({ title: "Payment not started", description: e.message, variant: "destructive" });
      setBusy(false);
    }
  };

  if (!data?.success || ["CANCELLED", "NO_SHOW"].includes(booking.status)) return null;

  return (
    <div className="bg-hotel-white p-6 border border-hotel-black/10">
      <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><Wallet size={18} className="text-hotel-gold" /> Balance</h3>
      {due <= 0 ? (
        <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16} /> Nothing to pay right now.</p>
      ) : (
        <>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xs uppercase tracking-widest text-hotel-black/50">Amount due</span>
            <span className="font-serif text-2xl text-hotel-black">{inr(due)}</span>
          </div>
          <p className="text-xs text-hotel-black/50 mb-4">
            {data.data.basis === "FOLIO" ? "Your current bill, including charges during your stay." : "Booking total less what you have already paid."}
          </p>
          {gateway === "UNAVAILABLE" ? (
            <p className="text-sm text-hotel-black/60">Online payment isn't available right now. Please pay at Reception.</p>
          ) : (
            <>
              <label className="block text-xs text-hotel-black/60 mb-1" htmlFor="part-amount">Pay part of it (optional)</label>
              <input id="part-amount" type="number" min={1} max={due} step="0.01" inputMode="decimal" placeholder={`Full amount ${inr(due)}`} value={part} onChange={(e) => setPart(e.target.value)} className={`${fieldCls} mb-3`} />
              <GoldButton onClick={pay} disabled={busy} className="w-full">
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Pay ${inr(part ? Number(part) || 0 : due)} online`}
              </GoldButton>
              {gateway === "DEMO" && <p className="mt-2 text-[11px] text-amber-700">Development mode: no gateway keys, payment is simulated.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── change request
const STATUS_STYLE: Record<string, { cls: string; icon: any; label: string }> = {
  PENDING: { cls: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock, label: "Waiting for Reception" },
  APPROVED: { cls: "bg-green-50 text-green-800 border-green-200", icon: CheckCircle2, label: "Approved" },
  DECLINED: { cls: "bg-red-50 text-red-800 border-red-200", icon: XCircle, label: "Declined" },
  WITHDRAWN: { cls: "bg-stone-50 text-stone-600 border-stone-200", icon: XCircle, label: "Withdrawn" },
};

function describeChange(cr: any) {
  const parts: string[] = [];
  const r = cr.requested ?? {};
  if (r.checkInDate) parts.push(`Check-in ${format(new Date(r.checkInDate), "dd MMM yyyy")}`);
  if (r.checkOutDate) parts.push(`Check-out ${format(new Date(r.checkOutDate), "dd MMM yyyy")}`);
  if (r.adults != null) parts.push(`${r.adults} adult${r.adults === 1 ? "" : "s"}`);
  if (r.children != null) parts.push(`${r.children} child${r.children === 1 ? "" : "ren"}`);
  return parts.join(" · ");
}

export function ChangeRequestPanel({ booking }: { booking: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inHouse = booking.status === "CHECKED_IN";
  const canRequest = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ checkInDate: ymd(booking.checkInDate), checkOutDate: ymd(booking.checkOutDate), adults: booking.adults ?? 1, children: booking.children ?? 0, note: "" });

  const { data } = useQuery({
    queryKey: ["myChangeRequests", booking._id],
    queryFn: () => api(`/api/customer/change-requests?bookingId=${booking._id}`, user?.token),
    enabled: !!user,
  });
  const rows: any[] = data?.data ?? [];
  const pending = rows.find((r) => r.status === "PENDING");
  const reload = () => qc.invalidateQueries({ queryKey: ["myChangeRequests", booking._id] });

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { note: form.note || undefined };
      if (form.checkInDate !== ymd(booking.checkInDate)) body.checkInDate = form.checkInDate;
      if (form.checkOutDate !== ymd(booking.checkOutDate)) body.checkOutDate = form.checkOutDate;
      if (Number(form.adults) !== booking.adults) body.adults = Number(form.adults);
      if (Number(form.children) !== booking.children) body.children = Number(form.children);
      return api(`/api/customer/bookings/${booking._id}/change-request`, user?.token, "POST", body);
    },
    onSuccess: (r) => {
      if (!r.success) return toast({ title: "Request not sent", description: r.message, variant: "destructive" });
      toast({ title: "Request sent", description: r.message });
      setOpen(false);
      reload();
    },
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api(`/api/customer/change-requests/${id}/withdraw`, user?.token, "POST"),
    onSuccess: (r) => {
      toast(r.success ? { title: "Request withdrawn" } : { title: "Couldn't withdraw", description: r.message, variant: "destructive" });
      reload();
    },
  });

  if (!canRequest && rows.length === 0) return null;

  return (
    <div className="bg-hotel-white p-6 border border-hotel-black/10">
      <h3 className="font-serif text-lg mb-2 flex items-center gap-2"><CalendarClock size={18} className="text-hotel-gold" /> Change this booking</h3>
      {canRequest && !pending && !open && (
        <>
          <p className="text-sm text-hotel-black/60 mb-4">
            {inHouse ? "Need to stay longer or leave earlier, or change guests? Ask Reception." : "Ask Reception to change your dates or guests. They'll confirm availability and any change in price."}
          </p>
          <OutlineButton onClick={() => setOpen(true)} className="w-full">Request a change</OutlineButton>
        </>
      )}
      {open && (
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-hotel-black/60">Check-in
              <input type="date" disabled={inHouse} value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} className={`${fieldCls} mt-1 disabled:opacity-60`} />
            </label>
            <label className="text-xs text-hotel-black/60">Check-out
              <input type="date" min={form.checkInDate} value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} className={`${fieldCls} mt-1`} />
            </label>
            <label className="text-xs text-hotel-black/60">Adults
              <input type="number" min={1} max={10} value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} className={`${fieldCls} mt-1`} />
            </label>
            <label className="text-xs text-hotel-black/60">Children
              <input type="number" min={0} max={10} value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} className={`${fieldCls} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-hotel-black/60">Note for Reception (optional)
            <textarea rows={2} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${fieldCls} mt-1`} />
          </label>
          <div className="flex gap-2">
            <OutlineButton type="button" onClick={() => setOpen(false)} className="flex-1">Cancel</OutlineButton>
            <GoldButton type="submit" disabled={submit.isPending} className="flex-1">
              {submit.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send request"}
            </GoldButton>
          </div>
        </form>
      )}
      {rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.slice(0, 5).map((cr) => {
            const s = STATUS_STYLE[cr.status] ?? STATUS_STYLE.PENDING;
            const Icon = s.icon;
            return (
              <li key={cr._id} className={`border p-3 text-xs ${s.cls}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-semibold"><Icon size={13} /> {s.label}</span>
                  <span className="opacity-70">{format(new Date(cr.createdAt), "dd MMM, HH:mm")}</span>
                </div>
                <p className="mt-1">{describeChange(cr)}</p>
                {cr.note && <p className="mt-1 opacity-80">You wrote: {cr.note}</p>}
                {cr.responseNote && <p className="mt-1 font-medium">Reception: {cr.responseNote}</p>}
                {cr.status === "PENDING" && (
                  <button type="button" onClick={() => withdraw.mutate(cr._id)} disabled={withdraw.isPending} className="mt-2 underline">Withdraw request</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── review
export function ReviewPanel({ booking }: { booking: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const { data } = useQuery({
    queryKey: ["myReviews"],
    queryFn: async () => (await api("/api/reviews/my", user?.token)).data ?? [],
    enabled: !!user && booking.status === "CHECKED_OUT",
  });
  const existing = (data ?? []).find((r: any) => String(r.booking?._id ?? r.booking) === String(booking._id));
  const submit = useMutation({
    mutationFn: () => api("/api/reviews", user?.token, "POST", { bookingId: booking._id, rating, title: title.trim(), comment: comment.trim() }),
    onSuccess: (r) => {
      if (!r.success) {
        const msg = r.errors?.[0] ? `${r.errors[0].path?.[0] ?? ""}: ${r.errors[0].message}` : r.message;
        return toast({ title: "Review not sent", description: msg, variant: "destructive" });
      }
      toast({ title: "Thank you!", description: "Your review will appear once it's approved." });
      qc.invalidateQueries({ queryKey: ["myReviews"] });
    },
  });

  if (booking.status !== "CHECKED_OUT") return null;

  return (
    <div className="bg-hotel-white p-6 border border-hotel-black/10">
      <h3 className="font-serif text-lg mb-3 flex items-center gap-2"><Star size={18} className="text-hotel-gold" /> Your review</h3>
      {existing ? (
        <div className="text-sm">
          <div className="flex gap-1 text-hotel-gold mb-1">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={14} fill={s <= existing.rating ? "currentColor" : "none"} />)}</div>
          <p className="font-medium">{existing.title}</p>
          <p className="text-hotel-black/70 mt-1">{existing.comment}</p>
          <p className="mt-2 text-xs text-hotel-black/50">Status: {existing.status === "PENDING" ? "awaiting approval" : existing.status.toLowerCase()}</p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} star${s > 1 ? "s" : ""}`} onClick={() => setRating(s)} className="text-hotel-gold">
                <Star size={24} fill={s <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <input required minLength={3} maxLength={100} placeholder="Title, e.g. Lovely stay" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
          <textarea required minLength={10} maxLength={1000} rows={4} placeholder="Tell us about your stay (at least 10 characters)" value={comment} onChange={(e) => setComment(e.target.value)} className={fieldCls} />
          <GoldButton type="submit" disabled={submit.isPending} className="w-full">
            {submit.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Submit review"}
          </GoldButton>
        </form>
      )}
    </div>
  );
}
