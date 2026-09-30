import React from "react";
import { LineChart, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

export function ForecastCommand({ forecast }: { forecast: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <LineChart size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">7-Day Forecast</h3>
            <p className="text-[11px] text-zinc-400">Occupancy & Revenue Projection</p>
          </div>
        </div>
        <Link to="/admin/reports" className="text-xs text-blue-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          View Trends &rarr;
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto">
        {(!forecast || !Array.isArray(forecast) || forecast.length === 0) ? (
          <div className="h-40 flex items-center justify-center text-zinc-500 text-xs">
            Forecast model generating...
          </div>
        ) : (
          <div className="min-w-[600px] h-full flex flex-col justify-end gap-1 px-2 pt-4">
            <div className="flex items-end justify-between h-32 gap-2 mb-2">
              {forecast.map((day: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group">
                  <span className="text-[10px] text-hotel-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                    ₹{day.revenue?.toLocaleString("en-IN") || 0}
                  </span>
                  <div className="w-full max-w-[40px] bg-white/5 rounded-t-sm relative group-hover:bg-white/10 transition-colors">
                    <div 
                      className="absolute bottom-0 left-0 w-full bg-blue-500/80 rounded-t-sm transition-all"
                      style={{ height: `${Math.min(100, day.occupancyPct || 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-[10px] text-zinc-400 font-mono">
              {forecast.map((day: any, i: number) => (
                <div key={i} className="flex-1 text-center truncate px-1">
                  {day.date}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
