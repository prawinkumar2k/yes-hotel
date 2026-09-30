import React from "react";
import { FrontOfficeCommand } from "../FrontOfficeCommand";
import { RoomControl } from "../RoomControl";
import { ExceptionCenter } from "../ExceptionCenter";

export function FrontDeskDashboard({ commandData }: { commandData: any }) {
  return (
    <div className="space-y-6">
      <RoomControl pulseData={commandData?.hotelPulse} />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <FrontOfficeCommand 
            arrivals={commandData?.arrivals} 
            departures={commandData?.departures} 
            inHouse={commandData?.inHouse} 
          />
        </div>
        <div className="lg:col-span-1 h-full">
          <ExceptionCenter actionQueue={commandData?.actionQueue || []} />
        </div>
      </div>
    </div>
  );
}
