import React from "react";
import { ArrowRight, Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

export function AdvanceCommand({ advances }: { advances: any }) {
  if (!advances) return null;

  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
            <Wallet size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Advance Payments</h3>
            <p className="text-[11px] text-zinc-400">Deposits & Prepayments</p>
          </div>
        </div>
        <Link to="/admin/advances" className="text-xs text-hotel-gold hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          View Ledger &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Held</span>
            <Wallet size={14} className="text-hotel-gold" />
          </div>
          <span className="font-sans text-xl font-bold text-white">
            {formatCurrency(advances.held)}
          </span>
        </div>
        
        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Received Today</span>
            <ArrowDownLeft size={14} className="text-emerald-400" />
          </div>
          <span className="font-sans text-xl font-bold text-white">
            {formatCurrency(advances.receivedToday)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Applied</span>
            <ArrowUpRight size={14} className="text-blue-400" />
          </div>
          <span className="font-sans text-xl font-bold text-white">
            {formatCurrency(advances.applied)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Refunded</span>
            <RefreshCw size={14} className="text-amber-400" />
          </div>
          <span className="font-sans text-xl font-bold text-white">
            {formatCurrency(advances.refunded)}
          </span>
        </div>
      </div>
    </div>
  );
}
