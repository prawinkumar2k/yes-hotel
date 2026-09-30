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
    <div className="bg-hotel-ivory/30 border border-hotel-charcoal/10 rounded-xl overflow-hidden shadow-sm">
      <div className="flex justify-between items-center p-4 border-b border-hotel-charcoal/5 bg-white">
        <div className="flex items-center gap-2 text-hotel-charcoal font-semibold">
          <Wallet size={18} className="text-hotel-gold" />
          Advance Payments
        </div>
        <Link to="/admin/advances" className="text-xs text-semantic-info font-medium flex items-center hover:underline whitespace-nowrap flex-shrink-0">
          View Ledger <ArrowRight size={14} className="ml-1" />
        </Link>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white">
        <div className="p-3 bg-hotel-gray rounded-lg border border-hotel-charcoal/5">
          <div className="text-xs text-hotel-charcoal/60 mb-1 flex items-center gap-1 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
            <Wallet size={12} className="text-hotel-gold"/> Held
          </div>
          <div className="text-xl font-bold text-hotel-charcoal">{formatCurrency(advances.held)}</div>
        </div>
        
        <div className="p-3 bg-hotel-gray rounded-lg border border-hotel-charcoal/5">
          <div className="text-xs text-hotel-charcoal/60 mb-1 flex items-center gap-1 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
            <ArrowDownLeft size={12} className="text-semantic-success"/> Received Today
          </div>
          <div className="text-xl font-bold text-semantic-success">{formatCurrency(advances.receivedToday)}</div>
        </div>

        <div className="p-3 bg-hotel-gray rounded-lg border border-hotel-charcoal/5">
          <div className="text-xs text-hotel-charcoal/60 mb-1 flex items-center gap-1 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
            <ArrowUpRight size={12} className="text-semantic-info"/> Applied
          </div>
          <div className="text-xl font-bold text-semantic-info">{formatCurrency(advances.applied)}</div>
        </div>

        <div className="p-3 bg-hotel-gray rounded-lg border border-hotel-charcoal/5">
          <div className="text-xs text-hotel-charcoal/60 mb-1 flex items-center gap-1 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
            <RefreshCw size={12} className="text-semantic-warning"/> Refunded
          </div>
          <div className="text-xl font-bold text-semantic-warning">{formatCurrency(advances.refunded)}</div>
        </div>
      </div>
    </div>
  );
}
