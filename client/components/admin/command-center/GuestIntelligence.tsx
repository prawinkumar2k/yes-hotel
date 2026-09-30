import React from "react";
import { UserPlus, Star, Heart } from "lucide-react";
import { Link } from "react-router-dom";

export function GuestIntelligence({ guests }: { guests: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
            <Star size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Guest Intelligence</h3>
            <p className="text-[11px] text-zinc-400">VIPs & Loyalty Status</p>
          </div>
        </div>
        <Link to="/admin/crm" className="text-xs text-hotel-gold hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          CRM &rarr;
        </Link>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-64">
        {(!guests?.vips || guests.vips.length === 0) ? (
          <p className="text-xs text-zinc-500 text-center py-10 flex items-center justify-center gap-2">
             No high-profile guests expected today.
          </p>
        ) : (
          guests.vips.map((vip: any, i: number) => (
            <div key={i} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">{vip.name}</span>
                  <span className="text-[9px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">VIP</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{vip.status} • {vip.requests} requests</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
