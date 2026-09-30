import React from "react";
import { HousekeepingAndMaintenanceControl } from "../HousekeepingMaintenanceControl";

export function HousekeepingDashboard({ commandData }: { commandData: any }) {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#121316] rounded-2xl border border-white/10 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2">My Cleaning Queue</h2>
        <p className="text-zinc-400 text-xs mb-6">Rooms assigned to you today</p>
        
        {/* We would filter tasks by assignedTo here in a real impl, but we show all for the stub */}
        <HousekeepingAndMaintenanceControl 
          housekeeping={commandData?.housekeeping}
          maintenance={{ tickets: [] }} // Housekeepers don't need to see maintenance tickets here
        />
      </div>
    </div>
  );
}
