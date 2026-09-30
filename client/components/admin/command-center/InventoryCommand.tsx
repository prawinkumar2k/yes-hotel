import React from "react";
import { Package, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function InventoryCommand({ inventory }: { inventory: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Package size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Inventory & Procurement</h3>
            <p className="text-[11px] text-zinc-400">Stock & Purchase Orders</p>
          </div>
        </div>
        <Link to="/admin/inventory" className="text-xs text-cyan-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Stores &rarr;
        </Link>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Pending Purchase Orders</span>
          <span className="text-xs font-mono text-white">{inventory?.pendingPO || 0}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Awaiting Approval (GM)</span>
          <span className="text-xs font-mono text-white bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{inventory?.awaitingApproval || 0}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition mt-2 border-t border-white/10 pt-3">
          <span className="text-xs text-zinc-300 flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-400" /> Low Stock Items
          </span>
          <span className="text-xs font-mono text-red-400 font-bold">{inventory?.lowStock || 0}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300 flex items-center gap-1.5">
            <AlertCircle size={12} className="text-red-400" /> Out of Stock
          </span>
          <span className="text-xs font-mono text-red-400 font-bold">{inventory?.outOfStock || 0}</span>
        </div>
      </div>
    </div>
  );
}
