import { useState, useEffect } from "react";
import { Users, Plus, RefreshCw, Search, Calendar, BedDouble, ChevronDown, ChevronUp, Loader2, CheckCircle, Clock, IndianRupee, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

type GroupStatus = "ENQUIRY" | "TENTATIVE" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

interface RoomBlock {
  categoryName: string;
  roomsRequired: number;
  roomsConfirmed: number;
  ratePerRoom: number;
}

interface GroupBooking {
  _id: string;
  groupName: string;
  groupCode: string;
  organiserName: string;
  organiserEmail: string;
  organiserPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalRooms: number;
  roomBlocks: RoomBlock[];
  totalPax: number;
  eventType: string;
  mealPlan: string;
  totalEstimatedValue: number;
  advancePaid: number;
  balance: number;
  status: GroupStatus;
  notes?: string;
  specialRequirements?: string;
  createdAt: string;
}

const STATUS_CFG: Record<GroupStatus, { label: string; color: string; bg: string; border: string }> = {
  ENQUIRY:     { label: "Enquiry",     color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
  TENTATIVE:   { label: "Tentative",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  CONFIRMED:   { label: "Confirmed",   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  CHECKED_IN:  { label: "Checked In",  color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  CHECKED_OUT: { label: "Checked Out", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  CANCELLED:   { label: "Cancelled",   color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
};

const EMPTY_FORM = {
  groupName: "", organiserName: "", organiserEmail: "", organiserPhone: "",
  checkIn: "", checkOut: "", totalRooms: 5, totalPax: 10,
  eventType: "corporate", mealPlan: "CP",
  totalEstimatedValue: 0, advancePaid: 0, notes: "", specialRequirements: "",
};

const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminGroupBookings() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<GroupStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [advanceModal, setAdvanceModal] = useState<{ id: string; code: string } | null>(null);
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [advanceSaving, setAdvanceSaving] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const url = filterStatus !== "ALL" ? `/api/group-bookings?status=${filterStatus}` : "/api/group-bookings";
      const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load group bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, [filterStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/group-bookings", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Group Booking Created", description: data.data.groupCode });
        setShowForm(false);
        setForm({ ...EMPTY_FORM });
        fetchGroups();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: GroupStatus) => {
    await fetch(`/api/group-bookings/${id}/status`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    fetchGroups();
  };

  const submitAdvance = async () => {
    if (!advanceModal || !advanceAmt) return;
    setAdvanceSaving(true);
    try {
      const res = await fetch(`/api/group-bookings/${advanceModal.id}/advance`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ amount: Number(advanceAmt) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Advance Recorded", description: `\u20B9${advanceAmt} recorded for ${advanceModal.code}` });
        setAdvanceModal(null);
        setAdvanceAmt("");
        fetchGroups();
      }
    } finally {
      setAdvanceSaving(false);
    }
  };


  const filtered = groups.filter(g =>
    g.groupName.toLowerCase().includes(search.toLowerCase()) ||
    g.groupCode.toLowerCase().includes(search.toLowerCase()) ||
    g.organiserName.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = groups.reduce((s, g) => s + g.totalEstimatedValue, 0);
  const totalAdvances = groups.reduce((s, g) => s + g.advancePaid, 0);
  const confirmedCount = groups.filter(g => ["CONFIRMED", "CHECKED_IN"].includes(g.status)).length;

  const STATUS_FLOW: GroupStatus[] = ["ENQUIRY", "TENTATIVE", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];
  const getNextStatus = (s: GroupStatus): GroupStatus | null => {
    const idx = STATUS_FLOW.indexOf(s);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" size={24} /> Group Bookings
          </h2>
          <p className="text-sm text-gray-500 mt-1">MICE, corporate, wedding and leisure group management</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Group
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Groups", value: groups.length, sub: `${confirmedCount} confirmed/in-house`, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Pipeline Value", value: `\u20B9${(totalRevenue/100000).toFixed(1)}L`, sub: "estimated total", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
          { label: "Advances Received", value: `\u20B9${(totalAdvances/1000).toFixed(0)}K`, sub: "total deposits", icon: IndianRupee, color: "text-amber-600 bg-amber-50" },
          { label: "Balance Due", value: `\u20B9${((totalRevenue-totalAdvances)/1000).toFixed(0)}K`, sub: "outstanding", icon: AlertCircle, color: "text-red-600 bg-red-50" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-md p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Plus size={16} className="text-blue-600" /> New Group Booking</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Group/Event Name *", key: "groupName", required: true, type: "text" },
              { label: "Organiser Name *", key: "organiserName", required: true, type: "text" },
              { label: "Organiser Email", key: "organiserEmail", type: "email" },
              { label: "Organiser Phone", key: "organiserPhone", type: "text" },
              { label: "Check-In *", key: "checkIn", required: true, type: "date" },
              { label: "Check-Out *", key: "checkOut", required: true, type: "date" },
            ].map(({ label, key, required, type }: any) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} required={required} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Rooms</label>
              <input type="number" min={1} value={form.totalRooms} onChange={e => setForm(f => ({ ...f, totalRooms: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Pax</label>
              <input type="number" min={1} value={form.totalPax} onChange={e => setForm(f => ({ ...f, totalPax: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
              <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {["corporate", "conference", "wedding", "leisure", "social", "government"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Meal Plan</label>
              <select value={form.mealPlan} onChange={e => setForm(f => ({ ...f, mealPlan: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {["EP", "CP", "MAP", "AP"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Value (\u20B9)</label>
              <input type="number" min={0} value={form.totalEstimatedValue} onChange={e => setForm(f => ({ ...f, totalEstimatedValue: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Advance Paid (\u20B9)</label>
              <input type="number" min={0} value={form.advancePaid} onChange={e => setForm(f => ({ ...f, advancePaid: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Special Requirements</label>
              <textarea rows={2} value={form.specialRequirements} onChange={e => setForm(f => ({ ...f, specialRequirements: e.target.value }))} placeholder="e.g. Airport transfers, early check-in, PA system, floral arrangements..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {saving ? "Creating..." : "Create Group Booking"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search group or organiser..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "ENQUIRY", "TENTATIVE", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "ALL" ? "All" : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
        <button onClick={fetchGroups} className="p-2 text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg"><RefreshCw size={15} /></button>
      </div>

      {/* Advance Payment Modal */}
      {advanceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-1">Record Advance Payment</h3>
            <p className="text-sm text-gray-500 mb-4">{advanceModal.code}</p>
            <input type="number" min={1} value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)} placeholder="Enter amount (\u20B9)" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none" />
            <div className="flex gap-3">
              <button onClick={submitAdvance} disabled={advanceSaving} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {advanceSaving ? <Loader2 size={14} className="animate-spin" /> : <IndianRupee size={14} />}
                {advanceSaving ? "Saving..." : "Record"}
              </button>
              <button onClick={() => { setAdvanceModal(null); setAdvanceAmt(""); }} className="flex-1 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Group List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400"><Loader2 size={32} className="animate-spin mx-auto mb-3" /><p className="text-sm">Loading group bookings...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Users size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No group bookings found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const cfg = STATUS_CFG[group.status];
            const isExp = expanded === group._id;
            const nextStatus = getNextStatus(group.status);
            const balancePct = group.totalEstimatedValue > 0 ? Math.round((group.advancePaid / group.totalEstimatedValue) * 100) : 0;

            return (
              <div key={group._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(isExp ? null : group._id)}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center flex-shrink-0">
                    <Users size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{group.groupName}</p>
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{group.groupCode}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{group.organiserName} &middot; {group.totalRooms} rooms &middot; {group.totalPax} pax &middot; {group.nights}N</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${balancePct >= 100 ? "bg-emerald-500" : balancePct >= 50 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${balancePct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{balancePct}% paid</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">\u20B9{(group.totalEstimatedValue/1000).toFixed(0)}K</p>
                    <p className="text-xs text-gray-400">est. value</p>
                    <p className={`text-xs mt-0.5 ${group.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>\u20B9{(group.balance/1000).toFixed(0)}K bal.</p>
                  </div>
                  <div className="text-gray-400 flex-shrink-0">{isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </div>

                {isExp && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><p className="text-xs text-gray-400 mb-0.5">Check-In</p><p className="text-sm font-medium text-gray-800 flex items-center gap-1"><Calendar size={12} />{new Date(group.checkIn).toLocaleDateString("en-IN")}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Check-Out</p><p className="text-sm font-medium text-gray-800 flex items-center gap-1"><Calendar size={12} />{new Date(group.checkOut).toLocaleDateString("en-IN")}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Event Type</p><p className="text-sm font-medium text-gray-800 capitalize">{group.eventType}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Meal Plan</p><p className="text-sm font-medium text-gray-800">{group.mealPlan}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-sm text-gray-700">{group.organiserEmail || ""}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Phone</p><p className="text-sm text-gray-700">{group.organiserPhone || ""}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Advance Paid</p><p className="text-sm font-semibold text-emerald-600">\u20B9{group.advancePaid.toLocaleString("en-IN")}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Balance Due</p><p className={`text-sm font-semibold ${group.balance > 0 ? "text-red-600" : "text-gray-500"}`}>\u20B9{group.balance.toLocaleString("en-IN")}</p></div>
                    </div>
                    {group.specialRequirements && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800">
                        <span className="font-medium">Special Requirements: </span>{group.specialRequirements}
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {nextStatus && group.status !== "CANCELLED" && (
                        <button onClick={() => updateStatus(group._id, nextStatus)} className={`flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${STATUS_CFG[nextStatus].bg.replace("bg-", "bg-").replace("-50", "-600 hover:bg-")}-700`} style={{ backgroundColor: "#2563eb" }}>
                          <CheckCircle size={13} /> Mark as {STATUS_CFG[nextStatus].label}
                        </button>
                      )}
                      <button onClick={() => { setAdvanceModal({ id: group._id, code: group.groupCode }); }} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        <IndianRupee size={13} /> Record Advance
                      </button>
                      {group.status !== "CANCELLED" && group.status !== "CHECKED_OUT" && (
                        <button onClick={() => updateStatus(group._id, "CANCELLED")} className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          Cancel Group
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
