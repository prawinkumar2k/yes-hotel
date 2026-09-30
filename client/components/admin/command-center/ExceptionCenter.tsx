import React from "react";
import { AlertCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export function ExceptionCenter({ actionQueue }: { actionQueue: any[] }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-red-500/20 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-red-400">REQUIRES ATTENTION</h3>
            <p className="text-[11px] text-red-500/60 font-mono">Action Queue</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-96 pr-2">
        {(!actionQueue || actionQueue.length === 0) ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
            No critical exceptions requiring attention.
          </div>
        ) : (
          actionQueue.map((action, i) => (
            <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 transition flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis ${action.priority === 'Critical' ? 'bg-red-500/20 text-red-500' : action.priority === 'High' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'}`}>
                  {action.priority} • {action.entity}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {new Date(action.time).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-white font-medium">{action.action}</p>
              <button className="text-left text-xs text-red-400 hover:text-red-300 font-semibold mt-1">
                Resolve Issue &rarr;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
