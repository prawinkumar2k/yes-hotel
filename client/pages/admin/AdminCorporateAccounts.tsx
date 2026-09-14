import { useState, useEffect } from "react";
import { Building2, Plus, Search, RefreshCw, CheckCircle, XCircle, CreditCard, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CorporateAccount {
  _id: string;
  companyName: string;
  companyCode: string;
  gstNumber: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  creditLimit: number;
  currentOutstanding: number;
  discountPercentage: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

const EMPTY_FORM = {
  companyName: "",
  companyCode: "",
  gstNumber: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  creditLimit: 100000,
  discountPercentage: 15,
  notes: "",
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminCorporateAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/corporate-accounts", { headers: getAuthHeaders(), credentials: "include" });
      const data = await res.json();
      if (data.success) setAccounts(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/corporate-accounts", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Account Registered", description: `${form.companyName} added successfully` });
        setShowForm(false);
        setForm({ ...EMPTY_FORM });
        fetchAccounts();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = accounts.filter(a =>
    a.companyName.toLowerCase().includes(search.toLowerCase()) ||
    a.companyCode.toLowerCase().includes(search.toLowerCase()) ||
    a.gstNumber.toLowerCase().includes(search.toLowerCase())
  );

  const totalCredit = accounts.reduce((s, a) => s + a.creditLimit, 0);
  const totalOutstanding = accounts.reduce((s, a) => s + a.currentOutstanding, 0);
  const activeCount = accounts.filter(a => a.isActive).length;
  const utilizationPct = (a: CorporateAccount) =>
    a.creditLimit > 0 ? Math.min(100, Math.round((a.currentOutstanding / a.creditLimit) * 100)) : 0;
  const utilizationColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-amber-600" size={24} />
            Corporate Accounts
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage B2B clients, credit limits and billing</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Register Account
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts", value: accounts.length, sub: `${activeCount} active`, icon: Building2, color: "text-blue-600 bg-blue-50" },
          { label: "Total Credit Limit", value: `\u20B9${(totalCredit/100000).toFixed(1)}L`, sub: "across all clients", icon: CreditCard, color: "text-emerald-600 bg-emerald-50" },
          { label: "Total Outstanding", value: `\u20B9${(totalOutstanding/1000).toFixed(0)}K`, sub: "unpaid balance", icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
          { label: "High Utilization", value: accounts.filter(a => utilizationPct(a) >= 80).length, sub: "\u226580% credit used", icon: AlertTriangle, color: accounts.filter(a => utilizationPct(a) >= 80).length > 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-50" },
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

      {showForm && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-md p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Plus size={16} className="text-amber-600" /> New Corporate Account</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Company Name *", key: "companyName", required: true, type: "text" },
              { label: "Company Code *", key: "companyCode", required: true, type: "text", placeholder: "e.g. TCS" },
              { label: "GST Number *", key: "gstNumber", required: true, type: "text", placeholder: "15-digit GSTIN" },
              { label: "Contact Person", key: "contactPerson", type: "text" },
              { label: "Contact Email", key: "contactEmail", type: "email" },
              { label: "Contact Phone", key: "contactPhone", type: "text" },
            ].map(({ label, key, required, type, placeholder }: any) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} required={required} placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Credit Limit (\u20B9)</label>
              <input type="number" min={10000} value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Discount % on rack rate</label>
              <input type="number" min={0} max={50} value={form.discountPercentage} onChange={e => setForm(f => ({ ...f, discountPercentage: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {saving ? "Saving..." : "Register Account"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, code or GST..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
        </div>
        <button onClick={fetchAccounts} className="p-2 text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg"><RefreshCw size={15} /></button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400"><Loader2 size={32} className="animate-spin mx-auto mb-3" /><p className="text-sm">Loading accounts...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Building2 size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No corporate accounts found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(account => {
            const pct = utilizationPct(account);
            const isExpanded = expanded === account._id;
            const available = account.creditLimit - account.currentOutstanding;
            return (
              <div key={account._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(isExpanded ? null : account._id)}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{account.companyCode.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{account.companyName}</p>
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{account.companyCode}</span>
                      {!account.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{account.gstNumber} &middot; {account.contactPerson}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${utilizationColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">\u20B9{(account.currentOutstanding/1000).toFixed(0)}K</p>
                    <p className="text-xs text-gray-400">outstanding</p>
                    <p className="text-xs text-emerald-600 mt-0.5">\u20B9{(available/1000).toFixed(0)}K avail.</p>
                  </div>
                  <div className="text-gray-400 flex-shrink-0">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-400 mb-0.5">Credit Limit</p><p className="font-semibold text-gray-800">\u20B9{account.creditLimit.toLocaleString("en-IN")}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Outstanding</p><p className={`font-semibold ${account.currentOutstanding > 0 ? "text-red-600" : "text-gray-800"}`}>\u20B9{account.currentOutstanding.toLocaleString("en-IN")}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Discount</p><p className="font-semibold text-emerald-600">{account.discountPercentage}% on rack rate</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Status</p><p className={`font-semibold flex items-center gap-1 ${account.isActive ? "text-emerald-600" : "text-red-500"}`}>{account.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}{account.isActive ? "Active" : "Inactive"}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-sm text-gray-700">{account.contactEmail || ""}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Phone</p><p className="text-sm text-gray-700">{account.contactPhone || ""}</p></div>
                    <div className="md:col-span-2"><p className="text-xs text-gray-400 mb-0.5">Notes</p><p className="text-sm text-gray-700">{account.notes || ""}</p></div>
                    {pct >= 80 && <div className="md:col-span-4 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm"><AlertTriangle size={14} />Credit utilization is {pct}%. Request payment before extending further credit.</div>}
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
