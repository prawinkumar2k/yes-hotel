import React from "react";
import { Moon, ShieldCheck, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export function NightAuditCommand({ audit }: { audit: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Moon size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Night Audit Readiness</h3>
            <p className="text-[11px] text-zinc-400">EOD Process Tracking</p>
          </div>
        </div>
        <Link to="/admin/night-audit" className="text-xs text-indigo-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Run Audit &rarr;
        </Link>
      </div>
      
      <div className="flex-1">
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between mb-4">
          <span className="text-sm text-zinc-300 font-medium">Audit Status</span>
          <span className="text-[10px] uppercase bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 font-bold flex items-center gap-1">
            <ShieldCheck size={12} /> Ready
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
            <span className="text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Unsettled Departures
            </span>
            <span className="text-white font-mono">{audit?.unsettledDepartures || 0}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
            <span className="text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> No-shows Pending
            </span>
            <span className="text-white font-mono">{audit?.noShows || 0}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
            <span className="text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Open POS Shifts
            </span>
            <span className="text-amber-400 font-mono">{audit?.openShifts || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
