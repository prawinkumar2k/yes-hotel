import React from "react";
import { Activity, Clock } from "lucide-react";

export function RecentActivityCommand({ activities }: { activities: any[] }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-hotel-gold/10 text-hotel-gold">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Recent Activity</h3>
            <p className="text-[11px] text-zinc-400">System Logs</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-96 pr-2">
        {!activities || activities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs py-8">
            <Clock size={32} className="mb-2 opacity-20" />
            <p className="font-medium">No recent activity detected.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activities.map((activity, i) => (
              <div key={i} className="p-3 rounded-xl bg-black/40 border border-white/5 flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-hotel-gold mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-sm text-white font-medium">{activity.action}</p>
                  <p className="text-zinc-500 text-[10px] mt-1 font-mono">
                    {activity.user} &bull; {new Date(activity.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
