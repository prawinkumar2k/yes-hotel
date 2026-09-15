import React, { useState, useEffect, useCallback } from "react";
import {
  UtensilsCrossed, Plus, RefreshCw, ChefHat, CheckCircle2, Clock,
  Loader2, Trash2, BedDouble, ShoppingCart, Send, Flame, AlertCircle,
  Check, X, Sparkles, Filter, Search, Tag, DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

const ORDER_STATUSES = ["KITCHEN_PENDING", "PREPARING", "READY", "SERVED", "BILLED", "CANCELLED"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

interface OrderItem { name: string; quantity: number; unitPrice: number; totalPrice: number; specialInstructions?: string; }
interface Order {
  _id: string;
  kotNumber: string;
  tableNumber?: string;
  roomNumber?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: OrderStatus;
  chargeToFolio: boolean;
  notes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; next?: OrderStatus }> = {
  KITCHEN_PENDING: { label: "Kitchen Pending", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", next: "PREPARING" },
  PREPARING:       { label: "Preparing",       color: "text-blue-400",  bg: "bg-blue-500/10",  border: "border-blue-500/30",  next: "READY" },
  READY:           { label: "Order Ready",      color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/30",next: "SERVED" },
  SERVED:          { label: "Served",           color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", next: "BILLED" },
  BILLED:          { label: "Billed",           color: "text-gray-400",   bg: "bg-gray-800",     border: "border-gray-700" },
  CANCELLED:       { label: "Cancelled",        color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
};

interface MenuItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  taxRatePercent: number;
  foodType: string;
  isAvailable: boolean;
}

interface CartItem { menuItemId: string; name: string; quantity: number; unitPrice: number; taxRatePercent: number; specialInstructions?: string; }

const getAuthHeaders = () => {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminPOS() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "ALL">("ALL");
  const [activeTab, setActiveTab] = useState<"kds" | "new">("kds");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNum, setTableNum] = useState("");
  const [roomNum, setRoomNum] = useState("");
  const [chargeToFolio, setChargeToFolio] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus !== "ALL" ? `/api/pos/orders?status=${filterStatus}` : "/api/pos/orders";
      const res = await fetch(url, { headers: getAuthHeaders(), credentials: "include" });
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const res = await fetch("/api/menu", { headers: getAuthHeaders(), credentials: "include" });
      const data = await res.json();
      if (data.success) setMenuItems(data.data);
    } catch {
      toast({ title: "Error", description: "Failed to load menu", variant: "destructive" });
    } finally {
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item._id);
      if (existing) return prev.map(c => c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item._id, name: item.name, quantity: 1, unitPrice: item.price, taxRatePercent: item.taxRatePercent }];
    });
  };

  const removeFromCart = (menuItemId: string) => setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(menuItemId);
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
  };

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const tax = Math.round(cart.reduce((s, c) => s + c.quantity * c.unitPrice * (c.taxRatePercent / 100), 0));
  const total = subtotal + tax;

  const categories = Array.from(new Set(menuItems.map(m => m.category))).sort();

  const filteredMenuItems = menuItems.filter(m => selectedCategory === "ALL" || m.category === selectedCategory);

  const submitOrder = async () => {
    if (cart.length === 0) return toast({ title: "Empty Cart", description: "Add at least one item from the menu", variant: "destructive" });
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          tableNumber: tableNum || undefined,
          roomNumber: roomNum || undefined,
          chargeToFolio,
          notes: orderNotes,
          items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity, specialInstructions: c.specialInstructions })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "KOT Sent to Kitchen!", description: `KOT #${data.data.kotNumber} dispatched.` });
        setCart([]);
        setTableNum("");
        setRoomNum("");
        setOrderNotes("");
        setChargeToFolio(false);
        setActiveTab("kds");
        fetchOrders();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const advanceStatus = async (order: Order) => {
    const next = STATUS_CONFIG[order.status].next;
    if (!next) return;
    setUpdatingId(order._id);
    try {
      const res = await fetch(`/api/pos/orders/${order._id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: next } : o));
        toast({ title: "Status Updated", description: `Order ${order.kotNumber} moved to ${STATUS_CONFIG[next].label}` });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Cooking elapsed time timer badge helper
  const getElapsedTimerBadge = (createdAtStr: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAtStr).getTime()) / 60000);
    if (mins < 10) {
      return <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500/30">{mins}m ago</span>;
    } else if (mins < 20) {
      return <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">{mins}m ago</span>;
    } else {
      return <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[10px] font-mono border border-red-500/30 font-bold animate-pulse">{mins}m OVERDUE</span>;
    }
  };

  const displayOrders = filterStatus === "ALL" ? orders : orders.filter(o => o.status === filterStatus);

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white p-12 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin text-[#c9a227] text-3xl font-serif font-bold">YES HOTELS</div>
        <p className="text-sm text-gray-400 mt-3 font-mono">Connecting to Kitchen Display System (KDS)...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#121316] p-6 rounded-2xl border border-[#262930] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a227]/10 rounded-xl border border-[#c9a227]/30 text-[#c9a227]">
            <UtensilsCrossed size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              Restaurant POS & Kitchen Display Lanes (KDS)
              <span className="text-xs bg-[#c9a227]/20 text-[#e5c76b] px-2.5 py-0.5 rounded-full font-mono border border-[#c9a227]/30">REAL-TIME F&B</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Live touch terminal, KOT dispatch, room charge folios & kitchen production lane monitoring
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d24] text-gray-300 hover:text-white rounded-xl transition text-xs font-semibold border border-[#262930]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh KDS
        </button>
      </div>

      {/* Production Lanes KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["KITCHEN_PENDING", "PREPARING", "READY", "SERVED"] as OrderStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = orders.filter(o => o.status === s).length;
          return (
            <div key={s} className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} transition-all hover:scale-[1.01]`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                <ChefHat size={16} className={cfg.color} />
              </div>
              <p className="text-3xl font-serif font-bold text-white">{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">Active Dockets</p>
            </div>
          );
        })}
      </div>

      {/* View Switcher Tabs */}
      <div className="flex gap-3 border-b border-[#262930] pb-2">
        <button
          onClick={() => setActiveTab("kds")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "kds" ? "bg-[#c9a227] text-black shadow-lg" : "bg-[#121316] text-gray-400 hover:text-white border border-[#262930]"
          }`}
        >
          <ChefHat size={16} /> Kitchen Production Lanes (KDS)
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "new" ? "bg-[#c9a227] text-black shadow-lg" : "bg-[#121316] text-gray-400 hover:text-white border border-[#262930]"
          }`}
        >
          <Plus size={16} /> Touch POS Terminal (New Order)
        </button>
      </div>

      {/* TAB 1: KDS PRODUCTION LANES */}
      {activeTab === "kds" && (
        <div className="space-y-6">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider mr-1">Filter Lane:</span>
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                filterStatus === "ALL" ? "bg-[#c9a227] text-black border-[#c9a227]" : "bg-[#1a1d24] text-gray-300 border-[#262930]"
              }`}
            >
              All Lanes ({orders.length})
            </button>
            {ORDER_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                  filterStatus === s ? "bg-[#c9a227] text-black border-[#c9a227]" : "bg-[#1a1d24] text-gray-300 border-[#262930]"
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {displayOrders.length === 0 ? (
            <div className="bg-[#121316] rounded-2xl border border-[#262930] p-16 text-center text-gray-500">
              <ChefHat size={40} className="mx-auto text-gray-600 mb-2 opacity-50" />
              <p className="text-sm font-medium">No active kitchen dockets in this production lane.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status];
                const isUpdating = updatingId === order._id;
                return (
                  <div key={order._id} className={`bg-[#121316] rounded-2xl border ${cfg.border} p-5 shadow-xl flex flex-col justify-between space-y-4`}>
                    {/* Header */}
                    <div className="space-y-2 border-b border-[#262930] pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-lg font-bold text-[#c9a227]">{order.kotNumber}</span>
                        {getElapsedTimerBadge(order.createdAt)}
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-white">
                          {order.tableNumber ? `Table ${order.tableNumber}` : ""}
                          {order.roomNumber ? ` Room ${order.roomNumber}` : ""}
                          {!order.tableNumber && !order.roomNumber ? "Takeaway" : ""}
                        </span>
                        {order.chargeToFolio && (
                          <span className="bg-[#c9a227]/20 text-[#e5c76b] px-2 py-0.5 rounded text-[10px] font-mono border border-[#c9a227]/30">
                            FOLIO CHARGE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Order Items Docket */}
                    <div className="space-y-2 flex-1 font-mono text-xs">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-gray-200 bg-[#1a1d24] p-2 rounded-lg border border-[#262930]">
                          <span><strong className="text-[#c9a227]">{item.quantity}x</strong> {item.name}</span>
                          <span className="text-gray-400">₹{item.totalPrice}</span>
                        </div>
                      ))}
                      {order.notes && (
                        <p className="text-[11px] text-amber-300 italic bg-amber-500/10 p-2 rounded border border-amber-500/20">
                          Note: "{order.notes}"
                        </p>
                      )}
                    </div>

                    {/* Footer & Action Trigger */}
                    <div className="border-t border-[#262930] pt-3 space-y-3">
                      <div className="flex justify-between text-xs font-bold font-mono">
                        <span className="text-gray-400">Docket Total:</span>
                        <span className="text-white">₹{order.grandTotal.toLocaleString()}</span>
                      </div>

                      {cfg.next && (
                        <button
                          onClick={() => advanceStatus(order)}
                          disabled={isUpdating}
                          className="w-full py-2.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Advance to {STATUS_CONFIG[cfg.next].label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TOUCH POS TERMINAL */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Menu Items Touch Grid */}
          <div className="lg:col-span-3 space-y-4">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                  selectedCategory === "ALL" ? "bg-[#c9a227] text-black border-[#c9a227]" : "bg-[#121316] text-gray-300 border-[#262930]"
                }`}
              >
                All Menu Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                    selectedCategory === cat ? "bg-[#c9a227] text-black border-[#c9a227]" : "bg-[#121316] text-gray-300 border-[#262930]"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {/* Menu Items Cards */}
            {menuLoading ? (
              <div className="text-center py-16 text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading Menu Catalog...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="bg-[#121316] p-12 text-center text-gray-500 rounded-2xl border border-[#262930]">
                <UtensilsCrossed size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredMenuItems.map(item => (
                  <button
                    key={item._id}
                    onClick={() => addToCart(item)}
                    disabled={!item.isAvailable}
                    className={`bg-[#121316] border border-[#262930] rounded-2xl p-4 text-left transition-all hover:border-[#c9a227] shadow-lg flex flex-col justify-between ${
                      item.isAvailable ? "hover:scale-[1.02]" : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          item.foodType === "VEG" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}>
                          {item.foodType || "VEG"}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.category}</span>
                      </div>
                      <p className="text-xs font-bold text-white line-clamp-2">{item.name}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#262930]">
                      <span className="text-sm font-mono font-bold text-[#c9a227]">₹{item.price}</span>
                      <span className="p-1 bg-[#1a1d24] text-gray-300 rounded-lg hover:text-white">
                        <Plus size={14} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Docket Cart */}
          <div className="lg:col-span-2">
            <div className="bg-[#121316] rounded-2xl border border-[#262930] p-5 shadow-2xl space-y-5 sticky top-6">
              <div className="flex items-center justify-between border-b border-[#262930] pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-[#c9a227]" />
                  <h3 className="font-serif text-sm font-bold text-white">Active Order Cart ({cart.length})</h3>
                </div>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-white">
                    Clear Cart
                  </button>
                )}
              </div>

              {/* Cart Item Lines */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto font-mono text-xs">
                {cart.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">Select food & beverage items from menu grid to build KOT.</p>
                ) : (
                  cart.map(item => (
                    <div key={item.menuItemId} className="flex items-center justify-between bg-[#1a1d24] p-2.5 rounded-xl border border-[#262930]">
                      <div className="flex-1">
                        <div className="text-white font-sans font-semibold">{item.name}</div>
                        <div className="text-[10px] text-gray-400">₹{item.unitPrice} each</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-[#121316] rounded-lg border border-[#262930] px-1">
                          <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)} className="px-1.5 py-0.5 text-gray-400 hover:text-white">-</button>
                          <span className="w-5 text-center font-bold text-white">{item.quantity}</span>
                          <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)} className="px-1.5 py-0.5 text-gray-400 hover:text-white">+</button>
                        </div>
                        <span className="w-14 text-right font-bold text-[#c9a227]">₹{item.quantity * item.unitPrice}</span>
                        <button onClick={() => removeFromCart(item.menuItemId)} className="text-gray-500 hover:text-red-400 pl-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Financial Breakdown */}
              {cart.length > 0 && (
                <div className="bg-[#1a1d24] p-3.5 rounded-xl border border-[#262930] space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal:</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>GST (Estimated):</span>
                    <span>₹{tax}</span>
                  </div>
                  <div className="border-t border-[#262930] pt-1.5 flex justify-between font-bold text-sm text-white">
                    <span>Grand Total:</span>
                    <span className="text-[#c9a227]">₹{total}</span>
                  </div>
                </div>
              )}

              {/* Order Metadata & Room Charge */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Table #</label>
                    <input
                      value={tableNum}
                      onChange={e => setTableNum(e.target.value)}
                      placeholder="e.g. T-04"
                      className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2 focus:border-[#c9a227]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Room # (Room Svc)</label>
                    <input
                      value={roomNum}
                      onChange={e => setRoomNum(e.target.value)}
                      placeholder="e.g. 201"
                      className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2 focus:border-[#c9a227]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Order Modifiers & Instructions</label>
                  <input
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="e.g. Extra spicy, no onions"
                    className="w-full bg-[#1a1d24] border border-[#262930] text-xs text-white rounded-xl p-2 focus:border-[#c9a227]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer bg-[#1a1d24] p-2.5 rounded-xl border border-[#262930]">
                  <input
                    type="checkbox"
                    checked={chargeToFolio}
                    onChange={e => setChargeToFolio(e.target.checked)}
                    className="rounded text-[#c9a227]"
                  />
                  <BedDouble size={15} className="text-[#c9a227]" />
                  Charge directly to In-House Guest Room Folio
                </label>

                <button
                  onClick={submitOrder}
                  disabled={submitting || cart.length === 0}
                  className="w-full py-3 bg-[#c9a227] hover:bg-[#e5c76b] text-black text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? "Dispatching KOT..." : "Dispatch KOT to Kitchen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
