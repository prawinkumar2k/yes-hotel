import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, BedDouble, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "../../lib/authStorage";

const MEALS = [
  { v: "EP", l: "EP – Room only" },
  { v: "CP", l: "CP – Breakfast" },
  { v: "MAP", l: "MAP – Breakfast + one meal" },
  { v: "AP", l: "AP – All meals" },
];
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const auth = () => {
  const t = getStoredAuthToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

type Props = { open: boolean; onClose: () => void; onSaved?: () => void; initial?: { name?: string; phone?: string; email?: string } };

/** Reserve rooms for a later stay and take the advance now. Rooms are held by type; room numbers are given at check-in. */
export default function AdvanceBookingDialog({ open, onClose, onSaved, initial }: Props) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [f, setF] = useState<any>({});
  const [quote, setQuote] = useState<any>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<any>(null);
  const requestId = useRef(uuid());
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    requestId.current = uuid();
    setDone(null);
    setQuote(null);
    setQuoteErr("");
    const t = today();
    setF({ name: initial?.name ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: "", gstin: "", categoryId: "", rooms: 1, adults: 2, children: 0, checkIn: t, checkOut: addDays(t, 1), arrivalTime: "", departureTime: "", mealPlan: "EP", rate: "", amount: "", channelId: "", reference: "", notes: "" });
    (async () => {
      try {
        const [c, p] = await Promise.all([
          fetch("/api/rooms/categories", { headers: auth() }).then((r) => r.json()),
          fetch("/api/payment-channels", { headers: auth() }).then((r) => r.json()),
        ]);
        const cats = c.data || [];
        const chs = (p.data || []).filter((x: any) => x.isActive);
        setCategories(cats);
        setChannels(chs);
        setF((x: any) => ({ ...x, categoryId: cats[0]?._id ?? "", channelId: chs[0]?._id ?? "" }));
      } catch {
        toast({ title: "Could not load room types", variant: "destructive" });
      }
    })();
  }, [open]);

  const body = useMemo(() => ({
    guest: { name: f.name, phone: f.phone, email: f.email, address: f.address, gstin: f.gstin },
    roomCategoryId: f.categoryId,
    rooms: Number(f.rooms),
    adults: Number(f.adults),
    children: Number(f.children || 0),
    checkIn: f.checkIn,
    checkOut: f.checkOut,
    arrivalTime: f.arrivalTime || undefined,
    departureTime: f.departureTime || undefined,
    mealPlan: f.mealPlan,
    ratePerNight: f.rate === "" || f.rate == null ? undefined : Number(f.rate),
    advance: { amount: Number(f.amount || 0), paymentChannelId: f.channelId, reference: f.reference },
    notes: f.notes,
  }), [f]);

  // Live price and availability. Guest name/phone are placeholders until typed so the server's validation lets the quote through.
  useEffect(() => {
    if (!open || !f.categoryId) return;
    const h = setTimeout(async () => {
      try {
        const q = { ...body, guest: { ...body.guest, name: f.name || "Guest", phone: f.phone || "0000000" }, advance: { amount: 0 } };
        const r = await fetch("/api/advances/bookings/quote", { method: "POST", headers: auth(), body: JSON.stringify(q) });
        const j = await r.json();
        if (j.success) {
          setQuote(j.data);
          setQuoteErr("");
        } else {
          setQuote(null);
          setQuoteErr(j.message || "Could not price this stay");
        }
      } catch {
        setQuoteErr("Could not price this stay");
      }
    }, 350);
    return () => clearTimeout(h);
  }, [open, body.roomCategoryId, body.rooms, body.adults, body.children, body.checkIn, body.checkOut, body.mealPlan, body.ratePerNight, f.gstin, f.email]);

  if (!open) return null;
  const adv = Number(f.amount || 0);
  const tooMuch = !!quote && adv > quote.roundedTotal;
  const balance = quote ? quote.roundedTotal - adv : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/advances/bookings", { method: "POST", headers: auth(), body: JSON.stringify({ ...body, clientRequestId: requestId.current }) });
      const j = await r.json();
      if (!j.success) {
        toast({ title: "Not saved", description: j.message, variant: "destructive" });
        return;
      }
      setDone(j.data);
      onSaved?.();
      toast({ title: j.message });
    } catch {
      toast({ title: "Network problem", description: "Nothing was confirmed. Press Save again — it will not double-book.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-gray-100 border border-gray-200 text-sm text-gray-800 rounded-xl p-2.5 focus:border-[#c9a227]";
  const lbl = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl text-gray-800 my-4">
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <h3 className="font-serif font-bold text-lg flex items-center gap-2"><BedDouble className="text-[#c9a227]" size={20} /> Reserve rooms with an advance</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close"><X size={20} /></button>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">
              <p className="font-bold text-emerald-800">Booking {done.bookingNumber} confirmed</p>
              <p className="text-emerald-900">{done.rooms} × {done.categoryName}, {done.checkIn} → {done.checkOut}. Advance {inr(done.advance?.amount ?? 0)} received{done.advance ? ` (${done.advance.number})` : ""}. Balance {inr(done.balance)}.</p>
              <p className="text-xs text-emerald-800 mt-1">Room numbers are given at arrival, in Front Desk → Arrivals. The advance is applied to the bill automatically.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <a href={`/admin/bookings/${done.primaryBookingId}/booking-confirmation`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#c9a227] text-white rounded-xl text-sm font-bold flex items-center gap-2"><Printer size={16} /> Print Booking Confirmation</a>
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-xl text-sm">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <section className="grid sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Guest name *</label><input className={inp} value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} required /></div>
              <div><label className={lbl}>Mobile *</label><input className={inp} inputMode="tel" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} required /></div>
              <div><label className={lbl}>Email (optional)</label><input className={inp} type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
              <div><label className={lbl}>Customer GSTIN (optional)</label><input className={inp} value={f.gstin ?? ""} maxLength={15} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Address</label><input className={inp} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
            </section>

            <section className="grid sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2"><label className={lbl}>Room type *</label>
                <select className={inp} value={f.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value)} required>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select></div>
              <div><label className={lbl}>Rooms *</label><input className={inp} type="number" min={1} value={f.rooms ?? 1} onChange={(e) => set("rooms", e.target.value)} /></div>
              <div><label className={lbl}>Meal plan</label>
                <select className={inp} value={f.mealPlan ?? "EP"} onChange={(e) => set("mealPlan", e.target.value)}>{MEALS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
              <div><label className={lbl}>Adults *</label><input className={inp} type="number" min={1} value={f.adults ?? 1} onChange={(e) => set("adults", e.target.value)} /></div>
              <div><label className={lbl}>Children</label><input className={inp} type="number" min={0} value={f.children ?? 0} onChange={(e) => set("children", e.target.value)} /></div>
              <div><label className={lbl}>Check-in *</label><input className={inp} type="date" min={today()} value={f.checkIn ?? ""} onChange={(e) => { set("checkIn", e.target.value); if (f.checkOut <= e.target.value) set("checkOut", addDays(e.target.value, 1)); }} /></div>
              <div><label className={lbl}>Check-out *</label><input className={inp} type="date" min={f.checkIn ? addDays(f.checkIn, 1) : undefined} value={f.checkOut ?? ""} onChange={(e) => set("checkOut", e.target.value)} /></div>
              <div><label className={lbl}>Arrival time</label><input className={inp} type="time" value={f.arrivalTime || quote?.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} /></div>
              <div><label className={lbl}>Departure time</label><input className={inp} type="time" value={f.departureTime || quote?.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Rate per room per night {quote ? `(${quote.pricesIncludeTax ? "GST included" : "+ GST"})` : ""}</label>
                <input className={inp} type="number" min={0} placeholder={quote ? String(quote.defaultRate) : ""} value={f.rate ?? ""} onChange={(e) => set("rate", e.target.value)} /></div>
            </section>

            <section className={`rounded-xl border p-3 text-sm ${quote && !quote.canBook ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              {quoteErr && <p className="text-red-700">{quoteErr}</p>}
              {quote && (
                <div className="space-y-1">
                  <p className={quote.canBook ? "text-emerald-700 font-semibold" : "text-red-700 font-bold"}>
                    {quote.canBook ? `${quote.availableRooms} ${quote.categoryName} room(s) free for these dates` : `Only ${quote.availableRooms} ${quote.categoryName} room(s) free — reduce the rooms or change dates`}
                  </p>
                  {quote.belowDefault && <p className="text-amber-700">Rate is below the standard {inr(quote.defaultRate)} — a manager will be asked to verify.</p>}
                  {quote.capacityWarning && <p className="text-amber-700">{quote.capacityWarning}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div>Taxable<br /><b>{inr(quote.taxable)}</b></div>
                    <div>GST ({quote.gstRate}%)<br /><b>{inr(quote.totalGst)}</b></div>
                    <div>{quote.nights} night(s) × {quote.rooms} room(s)<br />Total <b>{inr(quote.roundedTotal)}</b></div>
                    <div>Balance after advance<br /><b>{inr(balance)}</b></div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid sm:grid-cols-3 gap-3">
              <div><label className={lbl}>Advance amount (₹)</label><input className={inp} type="number" min={0} value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value)} />
                {tooMuch && <p className="text-xs text-red-600 mt-1">Advance is more than the total ({inr(quote.roundedTotal)})</p>}
                <p className="text-[11px] text-gray-500 mt-1">
                  Corporate, long-stay and regular guests: take 100% in advance (credit-based accounts: no advance).
                  {quote?.roundedTotal > 0 && <> <button type="button" className="underline text-blue-700" onClick={() => set("amount", String(quote.roundedTotal))}>Fill 100%</button></>}
                </p></div>
              <div><label className={lbl}>Payment channel</label>
                <select className={inp} value={f.channelId ?? ""} onChange={(e) => set("channelId", e.target.value)}>{channels.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
              <div><label className={lbl}>Reference / UTR</label><input className={inp} value={f.reference ?? ""} onChange={(e) => set("reference", e.target.value)} /></div>
              <div className="sm:col-span-3"><label className={lbl}>Notes</label><input className={inp} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
            </section>

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-xl text-sm">Cancel</button>
              <button type="submit" disabled={saving || !quote || !quote.canBook || tooMuch} className="px-5 py-2 bg-[#c9a227] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} {saving ? "Saving…" : "Confirm booking & take advance"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
