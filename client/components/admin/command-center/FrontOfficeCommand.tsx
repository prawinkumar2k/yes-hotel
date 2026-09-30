import React from "react";
import { Users } from "lucide-react";
import { Link } from "react-router-dom";

export function FrontOfficeCommand({ inHouse }: any) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* In-House */}
      <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">In-House Guests</h3>
              <p className="text-[11px] text-zinc-400">Active resident guests ({inHouse?.length || 0})</p>
            </div>
          </div>
          <Link to="/admin/in-house-list" className="text-xs text-hotel-gold hover:underline font-semibold whitespace-nowrap flex-shrink-0">
            Guest Log &rarr;
          </Link>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
          {(!inHouse || inHouse.length === 0) ? (
            <p className="text-xs text-zinc-500 text-center py-10">No guests currently in-house.</p>
          ) : (
            inHouse.map((h: any) => (
              <div key={h._id} className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-hotel-gold/30 transition flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs text-white truncate">
                      {h.guestDetails?.firstName} {h.guestDetails?.lastName}
                    </span>
                    {h.isVipGuest && (
                      <span className="text-[9px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">VIP</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-hotel-gold bg-hotel-gold/10 px-2 py-0.5 rounded border border-hotel-gold/20 whitespace-nowrap flex-shrink-0">
                    Room {h.assignedRoom?.roomNumber || "—"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
