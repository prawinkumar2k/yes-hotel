import React from "react";
import { CreditCard, Landmark, ArrowDownLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export function FinanceCommand({ finance }: { finance: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Landmark size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Financial Control</h3>
            <p className="text-[11px] text-zinc-400">Folios, Advances & Payables</p>
          </div>
        </div>
        <Link to="/admin/reports/finance" className="text-xs text-emerald-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Finance Desk &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Open Folios</p>
            <p className="text-xl font-bold text-white tabular-nums">{finance?.openFolios || 0}</p>
          </div>
          <FileText size={16} className="text-zinc-500" />
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Advances Held</p>
            <p className="text-xl font-bold text-white tabular-nums">₹{finance?.advancesHeld?.toLocaleString("en-IN") || 0}</p>
          </div>
          <ArrowDownLeft size={16} className="text-zinc-500" />
        </div>
      </div>
      
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Pending Refunds</span>
          <span className="text-xs font-mono text-white bg-red-500/20 px-2 py-0.5 rounded border border-red-500/20">{finance?.pendingRefunds || 0}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Corporate Receivables</span>
          <span className="text-xs font-mono text-white">₹{finance?.corporateReceivables?.toLocaleString("en-IN") || 0}</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Cashier Discrepancies</span>
          <span className="text-xs font-mono text-white bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">{finance?.cashierDiscrepancies || 0}</span>
        </div>
      </div>
    </div>
  );
}
