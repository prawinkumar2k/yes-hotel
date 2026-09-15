import { useState, useEffect } from "react";
import { Sparkles, Plus, RefreshCw, X, BedDouble } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { format } from "date-fns";

const CATEGORIES = ["SPA", "TRANSPORT", "LAUNDRY", "MINIBAR", "OTHER"] as const;

const CATEGORY_STYLE: Record<string, string> = {
  SPA: "bg-purple-100 text-purple-800",
  TRANSPORT: "bg-blue-100 text-blue-800",
  LAUNDRY: "bg-cyan-100 text-cyan-800",
  MINIBAR: "bg-amber-100 text-amber-800",
  OTHER: "bg-gray-100 text-gray-700",
};

interface AncillaryService {
  _id: string;
  serviceNumber: string;
  category: (typeof CATEGORIES)[number];
  serviceName: string;
  guestName: string;
  roomNumber?: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  isChargedToFolio: boolean;
  performedBy?: string;
  notes?: string;
  createdAt: string;
}

const emptyForm = {
  category: "SPA" as (typeof CATEGORIES)[number],
  serviceName: "", guestName: "", roomNumber: "", amount: "",
  chargeToFolio: false, performedBy: "", notes: "",
};

export default function AdminAncillary() {
  const { toast } = useToast();
  const [services, setServices] = useState<AncillaryService[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const url = filterCategory !== "ALL" ? `/ancillary?category=${filterCategory}` : "/ancillary";
      const res = await api.get(url);
      if (res.data.success) setServices(res.data.data);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to load services", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, [filterCategory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/ancillary", {
        category: form.category,
        serviceName: form.serviceName,
        guestName: form.guestName,
        roomNumber: form.roomNumber || undefined,
        amount: Number(form.amount),
        chargeToFolio: form.chargeToFolio,
        performedBy: form.performedBy || undefined,
        notes: form.notes || undefined,
      });
      if (res.data.success) {
        toast({ title: "Service Recorded", description: res.data.message });
        setShowModal(false);
        setForm(emptyForm);
        fetchServices();
      } else {
        toast({ title: "Error", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to record service", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-hotel-gold" size={24} />
            Ancillary Services
          </h2>
          <p className="text-sm text-gray-500 mt-1">Spa, transport, laundry, minibar and other guest services</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchServices} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-hotel-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Plus size={16} /> Record Service
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["ALL", ...CATEGORIES] as const).map(c => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCategory === c ? "bg-hotel-gold text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {c === "ALL" ? "All Services" : c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Service</th>
              <th className="text-left px-4 py-3">Guest</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3">Tax</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-center px-4 py-3">Folio</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : services.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No ancillary services recorded.</td></tr>
            ) : services.map(s => (
              <tr key={s._id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{s.serviceName}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.serviceNumber}</div>
                  {s.performedBy && <div className="text-xs text-gray-400">by {s.performedBy}</div>}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {s.guestName}
                  {s.roomNumber && <div className="text-xs text-gray-400 flex items-center gap-1"><BedDouble size={11} /> Room {s.roomNumber}</div>}
                </td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-semibold ${CATEGORY_STYLE[s.category]}`}>{s.category}</span></td>
                <td className="px-4 py-3 text-right">₹{s.amount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right text-gray-500">₹{s.taxAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right font-semibold">₹{s.totalAmount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-center">
                  {s.isChargedToFolio ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold">Charged</span> : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(s.createdAt), "MMM d, h:mm a")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Record Ancillary Service</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })} className="w-full border p-2 rounded-lg">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Amount (₹) *</label>
                  <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Service Name *</label>
                <input required type="text" value={form.serviceName} onChange={e => setForm({ ...form, serviceName: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="Aroma Therapy Massage 60 Min" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Guest Name *</label>
                  <input required type="text" value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} className="w-full border p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Room Number</label>
                  <input type="text" value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="e.g. 204" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Performed By</label>
                <input type="text" value={form.performedBy} onChange={e => setForm({ ...form, performedBy: e.target.value })} className="w-full border p-2 rounded-lg" placeholder="Therapist / driver name" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.chargeToFolio} onChange={e => setForm({ ...form, chargeToFolio: e.target.checked })} className="rounded" />
                <BedDouble size={14} className="text-hotel-gold" />
                Charge to Room Folio (requires an in-house guest with an open folio)
              </label>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border p-2 rounded-lg" rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-hotel-gold text-white rounded-lg font-semibold">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
