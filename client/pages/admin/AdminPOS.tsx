import { useState, useEffect, useCallback } from "react";
import { UtensilsCrossed, Plus, RefreshCw, ChefHat, CheckCircle2, Clock, Loader2, Trash2, BedDouble, ShoppingCart, Send } from "lucide-react";
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
  KITCHEN_PENDING: { label: "Kitchen Pending", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", next: "PREPARING" },
  PREPARING:       { label: "Preparing",       color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   next: "READY" },
  READY:           { label: "Ready",            color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200",next: "SERVED" },
  SERVED:          { label: "Served",           color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", next: "BILLED" },
  BILLED:          { label: "Billed",           color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
  CANCELLED:       { label: "Cancelled",        color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
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
  // Preview only — the server re-prices and re-taxes every line from the
  // MenuItem catalog itself and is the source of truth for the actual charge.
  const tax = Math.round(cart.reduce((s, c) => s + c.quantity * c.unitPrice * (c.taxRatePercent / 100), 0));
  const total = subtotal + tax;
  const menuByCategory = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const submitOrder = async () => {
    if (cart.length === 0) return toast({ title: "Empty cart", description: "Add at least one item", variant: "destructive" });
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
        toast({ title: "KOT Sent!", description: `${data.data.kotNumber} sent to kitchen` });
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
        toast({ title: "Status Updated", description: `Order ${order.kotNumber} marked as ${STATUS_CONFIG[next].label}` });
      }
    } finally {
      setUpdatingId(null);
    }
  };


  const displayOrders = filterStatus === "ALL" ? orders : orders.filter(o => o.status === filterStatus);
  const liveKitchenOrders = orders.filter(o => ["KITCHEN_PENDING", "PREPARING", "READY"].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="text-orange-600" size={24} />
            Restaurant POS & Kitchen Display
          </h2>
          <p className="text-sm text-gray-500 mt-1">Place orders, manage KOT and track kitchen status</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Live KDS Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(["KITCHEN_PENDING", "PREPARING", "READY"] as OrderStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = orders.filter(o => o.status === s).length;
          return (
            <div key={s} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
              <p className={`text-3xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">active orders</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "kds", label: "Kitchen Display (KDS)", icon: ChefHat },
          { id: "new", label: "New Order", icon: Plus },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* KDS Tab */}
      {activeTab === "kds" && (
        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            {(["ALL", ...ORDER_STATUSES] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s === "ALL" ? "All Orders" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400"><Loader2 size={32} className="animate-spin mx-auto mb-3" /><p className="text-sm">Loading orders...</p></div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><UtensilsCrossed size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No orders to display</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status];
                const isUpdating = updatingId === order._id;
                return (
                  <div key={order._id} className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                    <div className={`px-4 py-3 border-b ${cfg.border} flex items-center justify-between`}>
                      <div>
                        <p className={`font-bold text-sm ${cfg.color}`}>{order.kotNumber}</p>
                        <p className="text-xs text-gray-500">
                          {order.tableNumber ? `Table ${order.tableNumber}` : ""}
                          {order.roomNumber ? ` Room ${order.roomNumber}` : ""}
                          {!order.tableNumber && !order.roomNumber ? "Takeaway" : ""}
                          {order.chargeToFolio ? " · Charge to Room" : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.quantity}x {item.name}</span>
                          <span className="text-gray-600 font-medium">\u20B9{item.totalPrice}</span>
                        </div>
                      ))}
                      {order.notes && <p className="text-xs text-gray-400 italic mt-1">{order.notes}</p>}
                    </div>
                    <div className={`px-4 py-3 border-t ${cfg.border} flex items-center justify-between`}>
                      <div>
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="font-bold text-gray-900">\u20B9{order.grandTotal}</p>
                      </div>
                      {cfg.next && (
                        <button
                          onClick={() => advanceStatus(order)}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Mark {STATUS_CONFIG[cfg.next].label}
                        </button>
                      )}
                    </div>
                    <div className="px-4 pb-2">
                      <p className="text-xs text-gray-400"><Clock size={10} className="inline mr-1" />{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New Order Tab */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Menu Grid */}
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold text-gray-700 mb-3">Menu Items</p>
            {menuLoading ? (
              <div className="text-center py-12 text-gray-400"><Loader2 size={28} className="animate-spin mx-auto mb-2" /><p className="text-sm">Loading menu...</p></div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No menu items yet. Add items in Menu Management first.</p>
              </div>
            ) : (
              Object.entries(menuByCategory).map(([category, catItems]) => (
                <div key={category} className="mb-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{category.replace(/_/g, " ")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {catItems.map(item => (
                      <button
                        key={item._id}
                        onClick={() => addToCart(item)}
                        disabled={!item.isAvailable}
                        className={`bg-white border border-gray-200 rounded-xl p-3 text-left transition-all group ${item.isAvailable ? "hover:border-orange-300 hover:shadow-sm" : "opacity-40 cursor-not-allowed"}`}
                      >
                        <p className="text-sm font-medium text-gray-800 group-hover:text-orange-700">{item.name}</p>
                        <p className="text-sm text-orange-600 font-bold mt-1">\u20B9{item.price}</p>
                        {!item.isAvailable && <p className="text-[10px] text-red-500 font-semibold uppercase mt-0.5">Sold Out</p>}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-6">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ShoppingCart size={16} className="text-orange-600" />
                <p className="font-semibold text-gray-800">Order Cart ({cart.length} items)</p>
              </div>

              <div className="px-4 py-3 space-y-2 max-h-52 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Add items from the menu</p>
                ) : (
                  cart.map(item => (
                    <div key={item.menuItemId} className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{item.name}</p>
                        <p className="text-xs text-orange-600">\u20B9{item.unitPrice} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)} className="w-6 h-6 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200">-</button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)} className="w-6 h-6 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200">+</button>
                      </div>
                      <p className="text-sm font-medium text-gray-800 w-16 text-right">\u20B9{item.quantity * item.unitPrice}</p>
                      <button onClick={() => removeFromCart(item.menuItemId)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>\u20B9{subtotal}</span></div>
                  <div className="flex justify-between text-gray-600"><span>GST</span><span>\u20B9{tax}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200"><span>Total</span><span>\u20B9{total}</span></div>
                </div>
              )}

              <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Table #</label>
                    <input value={tableNum} onChange={e => setTableNum(e.target.value)} placeholder="e.g. T-05" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room # (if room svc)</label>
                    <input value={roomNum} onChange={e => setRoomNum(e.target.value)} placeholder="e.g. 205" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Order Notes</label>
                  <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="e.g. No onion, less spicy..." className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={chargeToFolio} onChange={e => setChargeToFolio(e.target.checked)} className="rounded" />
                  <BedDouble size={14} className="text-orange-600" />
                  Charge to Room Folio
                </label>
                <button
                  onClick={submitOrder}
                  disabled={submitting || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? "Sending to Kitchen..." : "Send to Kitchen (KOT)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
