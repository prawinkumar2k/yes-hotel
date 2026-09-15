import { useState, useEffect } from "react";
import { PartyPopper, Plus, RefreshCw, X, Calendar, Users, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { format } from "date-fns";

const STATUSES = ["INQUIRY", "QUOTATION_SENT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
type BanquetStatus = (typeof STATUSES)[number];

const STATUS_FLOW: Record<BanquetStatus, BanquetStatus | undefined> = {
  INQUIRY: "QUOTATION_SENT",
  QUOTATION_SENT: "CONFIRMED",
  CONFIRMED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: undefined,
  CANCELLED: undefined,
};

const STATUS_STYLE: Record<BanquetStatus, string> = {
  INQUIRY: "bg-gray-100 text-gray-700",
  QUOTATION_SENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface Banquet {
  _id: string;
  bookingNumber: string;
  eventName: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  hallName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  expectedPax: number;
  menuPackage: string;
  ratePerPax: number;
  totalEstimatedAmount: number;
  advancePaid: number;
  status: BanquetStatus;
  notes?: string;
}

const emptyForm = {
  eventName: "", clientName: "", clientPhone: "", clientEmail: "",
  hallName: "Grand Ball Room", eventDate: "", expectedPax: "", menuPackage: "",
  ratePerPax: "", advancePaid: "0", notes: "",
};

export default function AdminBanquets() {
  const { toast } = useToast();
  const [banquets, setBanquets] = useState<Banquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchBanquets = async () => {
    setLoading(true);
    try {
      const url = filterStatus !== "ALL" ? `/banquets?status=${filterStatus}` : "/banquets";
      const res = await api.get(url);
      if (res.data.success) setBanquets(res.data.data);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load banquets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBanquets(); }, [filterStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/banquets", {
        eventName: form.eventName,
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        clientEmail: form.clientEmail || undefined,
        hallName: form.hallName,
        eventDate: form.eventDate,
        expectedPax: Number(form.expectedPax),
        menuPackage: form.menuPackage || undefined,
        ratePerPax: Number(form.ratePerPax),
        advancePaid: Number(form.advancePaid) || 0,
        notes: form.notes || undefined,
      });
      if (res.data.success) {
        toast({ title: "Banquet Inquiry Created", description: res.data.message });
        setShowModal(false);
        setForm(emptyForm);
        fetchBanquets();
      } else {
        toast({ title: "Error", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to create banquet", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async (b: Banquet) => {
    const next = STATUS_FLOW[b.status];
    if (!next) return;
    try {
      const res = await api.patch(`/banquets/${b._id}/status`, { status: next });
      if (res.data.success) {
        toast({ title: "Status Updated", description: `${b.bookingNumber} → ${next}` });
        fetchBanquets();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update status", variant: "destructive" });
    }
  };

  const cancelBanquet = async (b: Banquet) => {
    try {
      const res = await api.patch(`/banquets/${b._id}/status`, { status: "CANCELLED" });
      if (res.data.success) {
        toast({ title: "Banquet Cancelled", description: b.bookingNumber });
        fetchBanquets();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to cancel", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PartyPopper className="text-hotel-gold" size={24} />
            Banquets & Events
          </h2>
          <p className="text-sm text-gray-500 mt-1">Hall bookings, quotations, and event lifecycle</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchBanquets} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-hotel-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Plus size={16} /> New Inquiry
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["ALL", ...STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-hotel-gold text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s === "ALL" ? "All Events" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : banquets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PartyPopper size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No banquet events found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banquets.map(b => {
            const outstanding = Math.max(0, b.totalEstimatedAmount - b.advancePaid);
            const next = STATUS_FLOW[b.status];
            return (
              <div key={b._id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3 text-gray-900">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs text-gray-400 font-bold">{b.bookingNumber}</span>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{b.eventName}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${STATUS_STYLE[b.status]}`}>{b.status.replace(/_/g, " ")}</span>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-400" /> {format(new Date(b.eventDate), "MMM d, yyyy")} · {b.hallName}</div>
                  <div className="flex items-center gap-1.5"><Users size={12} className="text-gray-400" /> {b.expectedPax} pax · {b.menuPackage}</div>
                  <div>{b.clientName} · {b.clientPhone}</div>
                </div>

                <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Estimated Total</span><span className="font-semibold">₹{b.totalEstimatedAmount.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Advance Paid</span><span className="text-emerald-700 font-semibold">₹{b.advancePaid.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className={`font-bold ${outstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>₹{outstanding.toLocaleString("en-IN")}</span></div>
                </div>

                {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    {next && (
                      <button onClick={() => advanceStatus(b)} className="flex-1 text-xs font-semibold bg-hotel-black hover:bg-gray-800 text-white py-1.5 rounded-lg">
                        Move to {next.replace(/_/g, " ")}
                      </button>
                    )}
                    <button onClick={() => cancelBanquet(b)} className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">New Banquet Inquiry</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Event Name *</label>
                <input required type="text" value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="Annual Corporate Gala" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Client Name *</label>
                  <input required type="text" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Client Phone *</label>
                  <input required type="text" value={form.clientPhone} onChange={e => setForm({ ...form, clientPhone: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Client Email</label>
                <input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} className="w-full border p-2 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Hall</label>
                  <input type="text" value={form.hallName} onChange={e => setForm({ ...form, hallName: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Event Date *</label>
                  <input required type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Expected Pax *</label>
                  <input required type="number" min="1" value={form.expectedPax} onChange={e => setForm({ ...form, expectedPax: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Rate / Pax (₹) *</label>
                  <input required type="number" min="0" step="0.01" value={form.ratePerPax} onChange={e => setForm({ ...form, ratePerPax: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Menu Package</label>
                  <input type="text" value={form.menuPackage} onChange={e => setForm({ ...form, menuPackage: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="Standard Buffet" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1"><IndianRupee size={11} /> Advance Paid</label>
                  <input type="number" min="0" step="0.01" value={form.advancePaid} onChange={e => setForm({ ...form, advancePaid: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border p-2 rounded-lg" rows={2} />
              </div>
              {form.expectedPax && form.ratePerPax && (
                <p className="text-xs text-gray-500">Estimated total: <strong>₹{(Number(form.expectedPax) * Number(form.ratePerPax)).toLocaleString("en-IN")}</strong></p>
              )}
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-hotel-gold text-white rounded-lg font-semibold">{saving ? "Saving..." : "Create Inquiry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
