import React from "react";
import { Activity, Clock } from "lucide-react";

export function RecentActivityCommand({ activities }: { activities: any[] }) {
  return (
    <div className="bg-white border border-hotel-charcoal/10 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-hotel-charcoal/5">
        <div className="flex items-center gap-2 text-hotel-charcoal font-semibold">
          <Activity size={18} className="text-hotel-gold" />
          Recent Activity
        </div>
      </div>
      <div className="p-4 flex-1 overflow-y-auto max-h-64">
        {!activities || activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-hotel-charcoal/40 py-8">
            <Clock size={32} className="mb-2 opacity-20" />
            <p className="text-sm font-medium">No recent activity detected.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-semantic-info mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-hotel-charcoal font-medium">{activity.action}</p>
                  <p className="text-hotel-charcoal/60 text-xs mt-0.5">{new Date(activity.time).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
