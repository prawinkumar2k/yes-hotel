import React from "react";
import { RoomControl } from "../RoomControl";
import { RevenueCommand } from "../RevenueCommand";
import { ForecastCommand } from "../ForecastCommand";
import { CorporateCommand } from "../CorporateCommand";
import { BanquetCommand } from "../BanquetCommand";

export function ReservationsDashboard({ commandData }: { commandData: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RevenueCommand revenue={commandData?.revenue} />
        <RoomControl pulseData={commandData?.hotelPulse} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ForecastCommand forecast={commandData?.forecast} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <CorporateCommand corporate={commandData?.corporate} />
          <BanquetCommand banquets={commandData?.banquets} />
        </div>
      </div>
    </div>
  );
}
