import React from "react";
import { GlassWater, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";

export function BanquetCommand({ banquets }: { banquets: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
            <GlassWater size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Banquets & Events</h3>
            <p className="text-[11px] text-zinc-400">Venue Management</p>
          </div>
        </div>
        <Link to="/admin/banquets" className="text-xs text-pink-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Diary &rarr;
        </Link>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
        {(!banquets?.events || banquets.events.length === 0) ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
            No events scheduled today.
          </div>
        ) : (
          banquets.events.map((event: any, i: number) => (
            <div key={i} className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{event.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis bg-pink-500/20 text-pink-400">
                  {event.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1"><CalendarClock size={10} /> {event.time}</span>
                <span>•</span>
                <span>{event.venue}</span>
                <span>•</span>
                <span>{event.pax} Pax</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
