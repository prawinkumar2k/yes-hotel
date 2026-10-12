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
              <p className="text-[11px] text-zinc-400">Active resident guests ({inHouse?.guests?.length || 0})</p>
            </div>
          </div>
          <Link to="/admin/in-house-list" className="text-xs text-hotel-gold hover:underline font-semibold whitespace-nowrap flex-shrink-0">
            Guest Log &rarr;
          </Link>
        </div>

        {inHouse?.stats && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 border-b border-white/5 pb-4">
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">Exp. Arr</div><div className="text-sm font-bold text-white">{inHouse.stats.expectedArrivals}</div></div>
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">Act. Arr</div><div className="text-sm font-bold text-white">{inHouse.stats.actualArrivals}</div></div>
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">Exp. Dep</div><div className="text-sm font-bold text-white">{inHouse.stats.expectedDepartures}</div></div>
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">Act. Dep</div><div className="text-sm font-bold text-white">{inHouse.stats.actualCheckouts}</div></div>
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">No Shows</div><div className="text-sm font-bold text-white">{inHouse.stats.noShows}</div></div>
            <div className="bg-black/40 rounded p-2 text-center border border-white/5"><div className="text-[10px] text-zinc-500 uppercase">Cancels</div><div className="text-sm font-bold text-white">{inHouse.stats.cancellations}</div></div>
          </div>
        )}

        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
          {(!inHouse?.guests || inHouse.guests.length === 0) ? (
            <p className="text-xs text-zinc-500 text-center py-10">No guests currently in-house.</p>
          ) : (
            inHouse.guests.map((h: any) => (
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
