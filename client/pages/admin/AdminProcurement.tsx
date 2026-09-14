import { useState, useEffect } from "react";
import { ShoppingBag, Plus, RefreshCw, CheckCircle, Clock, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  vendorName: string;
  items: Array<{ itemName: string; quantity: number; unitCost: number; totalCost: number; receivedQuantity: number }>;
  totalAmount: number;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";
  issuedDate: string;
}

interface Vendor { _id: string; name: string; }
interface InventoryItem { _id: string; name: string; unitCost: number; }

const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminProcurement() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState("10");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPO, resVen, resInv] = await Promise.all([
        fetch("/api/procurement/purchase-orders", { headers: getAuthHeaders() }),
        fetch("/api/vendors", { headers: getAuthHeaders() }),
        fetch("/api/inventory", { headers: getAuthHeaders() }),
      ]);

      const dataPO = await resPO.json();
      const dataVen = await resVen.json();
      const dataInv = await resInv.json();

      if (dataPO.success) setOrders(dataPO.data);
      if (dataVen.success) setVendors(dataVen.data);
      if (dataInv.success) setInventoryItems(dataInv.data);
    } catch {
      toast({ title: "Error", description: "Failed to load procurement data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !selectedItem) return;
    setSaving(true);
    try {
      const itemObj = inventoryItems.find(i => i._id === selectedItem);
      const res = await fetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          vendorId: selectedVendor,
          items: [{ itemId: selectedItem, quantity: Number(qty), unitCost: itemObj?.unitCost || 100 }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purchase Order Issued", description: data.data.poNumber });
        setShowCreate(false);
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCompletePO = async (poId: string) => {
    try {
      const res = await fetch(`/api/procurement/purchase-orders/${poId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "COMPLETED", receiveItems: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Goods Received (GRN)", description: "Stock quantities auto-updated in inventory" });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to process GRN receiving", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={24} />
            Procurement & Purchase Orders
          </h2>
          <p className="text-sm text-gray-500 mt-1">Issue POs to vendors and auto-receive inventory via GRN</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Create Purchase Order
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">PO Number</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Items Summary</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No purchase orders found</td>
              </tr>
            ) : (
              orders.map(po => (
                <tr key={po._id}>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{po.vendorName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {po.items.map(i => `${i.itemName} x${i.quantity}`).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">₹{po.totalAmount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      po.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                      po.status === "DRAFT" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {po.status !== "COMPLETED" && (
                      <button
                        onClick={() => handleCompletePO(po._id)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-xs font-semibold"
                      >
                        Receive Goods (GRN)
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Issue Purchase Order</h3>
            <form onSubmit={handleCreatePO} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Select Supplier Vendor</label>
                <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} required className="w-full border p-2 rounded-lg">
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Select Stock Item</label>
                <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} required className="w-full border p-2 rounded-lg">
                  <option value="">-- Choose Item --</option>
                  {inventoryItems.map(i => <option key={i._id} value={i._id}>{i.name} (Unit Cost: ₹{i.unitCost})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Order Quantity</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} required className="w-full border p-2 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">{saving ? "Issuing..." : "Issue PO"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
