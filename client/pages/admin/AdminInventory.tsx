import { useState, useEffect } from "react";
import { Package, Plus, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownLeft, Layers, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

interface InventoryItem {
  _id: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  minStockLevel: number;
  currentStock: number;
  unitCost: number;
  storeLocation: string;
}

interface Transaction {
  _id: string;
  transactionNumber: string;
  type: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  referenceNumber?: string;
  createdAt: string;
}

const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminInventory() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"stock" | "transactions">("stock");

  // Stock Adjustment Modal State
  const [adjModal, setAdjModal] = useState<InventoryItem | null>(null);
  const [adjType, setAdjType] = useState<"GRN" | "ISSUE" | "WASTAGE" | "ADJUSTMENT">("GRN");
  const [adjQty, setAdjQty] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [resItems, resTxns] = await Promise.all([
        fetch("/api/inventory", { headers: getAuthHeaders() }),
        fetch("/api/inventory/transactions", { headers: getAuthHeaders() }),
      ]);
      const dataItems = await resItems.json();
      const dataTxns = await resTxns.json();

      if (dataItems.success) setItems(dataItems.data);
      if (dataTxns.success) setTransactions(dataTxns.data);
    } catch {
      toast({ title: "Error", description: "Failed to load inventory data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjModal || !adjQty || Number(adjQty) <= 0) return;
    setAdjSaving(true);
    try {
      const res = await fetch("/api/inventory/transaction", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemId: adjModal._id,
          type: adjType,
          quantity: Number(adjQty),
          notes: adjNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Stock Transaction Recorded", description: `${adjType} recorded for ${adjModal.name}` });
        setAdjModal(null);
        setAdjQty("");
        setAdjNotes("");
        fetchInventory();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setAdjSaving(false);
    }
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.itemCode.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = items.filter(i => i.currentStock <= i.minStockLevel).length;
  const totalStockValue = items.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-indigo-600" size={24} />
            Inventory & Store Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">Multi-store stock tracking, GRN receipts, and issues</p>
        </div>
        <button onClick={fetchInventory} className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Total SKU Items</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
          </div>
          <Layers className="text-indigo-500" size={28} />
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Low Stock Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {lowStockCount}
            </p>
          </div>
          <AlertTriangle className={lowStockCount > 0 ? "text-amber-500" : "text-emerald-500"} size={28} />
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Total Valuation</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalStockValue.toLocaleString()}</p>
          </div>
          <Package className="text-emerald-500" size={28} />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab("stock")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "stock" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stock Items ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "transactions" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stock Audit Ledger ({transactions.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search items by code, name, category..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      {/* Main Stock Table View */}
      {activeTab === "stock" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">SKU Code</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Stock Level</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No inventory items found</td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isLow = item.currentStock <= item.minStockLevel;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{item.itemCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">
                          {item.category.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.storeLocation}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isLow ? "text-amber-600" : "text-gray-900"}`}>
                            {item.currentStock} {item.unit}
                          </span>
                          {isLow && (
                            <span className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                              <AlertTriangle size={10} /> Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">₹{item.unitCost}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setAdjModal(item); setAdjQty(""); setAdjType("GRN"); }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Record Stock Movement
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Transactions View */}
      {activeTab === "transactions" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Txn #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(txn => (
                <tr key={txn._id}>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{txn.transactionNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      txn.type === "GRN" ? "bg-emerald-100 text-emerald-800" :
                      txn.type === "ISSUE" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{txn.itemName}</td>
                  <td className="px-4 py-3">{txn.quantity}</td>
                  <td className="px-4 py-3">₹{txn.totalValue}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Stock Movement: {adjModal.name}</h3>
            <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Transaction Type</label>
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                >
                  <option value="GRN">GRN (Goods Receipt / Stock In)</option>
                  <option value="ISSUE">ISSUE (Issued to Kitchen/Housekeeping)</option>
                  <option value="WASTAGE">WASTAGE (Spoiled / Damaged)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Audit Physical Count)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Quantity ({adjModal.unit})</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder={`Current stock: ${adjModal.currentStock}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Notes / Ref Number</label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={e => setAdjNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder="e.g. Received from Amul Vendor invoice #102"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjModal(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                >
                  {adjSaving ? "Recording..." : "Confirm Stock Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
