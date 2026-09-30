import React from "react";
import { HousekeepingAndMaintenanceControl } from "../HousekeepingMaintenanceControl";

export function MaintenanceDashboard({ commandData }: { commandData: any }) {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#121316] rounded-2xl border border-white/10 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2">My Maintenance Queue</h2>
        <p className="text-zinc-400 text-xs mb-6">Tickets assigned to you today</p>
        
        <HousekeepingAndMaintenanceControl 
          housekeeping={{ tasks: [] }} // Maintenance doesn't need housekeeping tasks here
          maintenance={commandData?.maintenance}
        />
      </div>
    </div>
  );
}
