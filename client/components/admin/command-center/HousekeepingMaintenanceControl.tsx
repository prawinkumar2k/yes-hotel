import React from "react";
import { Sparkles, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

export function HousekeepingAndMaintenanceControl({ housekeeping, maintenance }: { housekeeping: any, maintenance: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Housekeeping */}
      <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Housekeeping</h3>
              <p className="text-[11px] text-zinc-400">{housekeeping?.pending || 0} tasks pending</p>
            </div>
          </div>
          <Link to="/admin/housekeeping" className="text-xs text-blue-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
            Manage &rarr;
          </Link>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
          {(!housekeeping?.tasks || housekeeping.tasks.length === 0) ? (
            <p className="text-xs text-zinc-500 text-center py-6">All rooms clean.</p>
          ) : (
            housekeeping.tasks.map((t: any) => (
              <div key={t._id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-white">Room {t.room?.roomNumber || "—"}</span>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{t.taskType}</p>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis bg-blue-500/20 text-blue-400">
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <Wrench size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Maintenance</h3>
              <p className="text-[11px] text-zinc-400">{maintenance?.open || 0} open tickets</p>
            </div>
          </div>
          <Link to="/admin/maintenance" className="text-xs text-orange-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
            Manage &rarr;
          </Link>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
          {(!maintenance?.tickets || maintenance.tickets.length === 0) ? (
            <p className="text-xs text-zinc-500 text-center py-6">No active maintenance issues.</p>
          ) : (
            maintenance.tickets.map((t: any) => (
              <div key={t._id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-white">Room {t.room?.roomNumber || "—"}</span>
                  <p className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[120px]">{t.issueDescription}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis ${t.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-400'}`}>
                  {t.priority}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
