import React from "react";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ApprovalCommand({ approvals }: { approvals: any }) {
  if (!approvals) return null;

  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Task Approvals</h3>
            <p className="text-[11px] text-zinc-400">Pending Actions</p>
          </div>
        </div>
        <Link to="/admin/approvals" className="text-xs text-indigo-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Manage &rarr;
        </Link>
      </div>
      <div className="flex-1 bg-black/40 border border-white/5 rounded-xl flex flex-col justify-center items-center p-4">
        <div className="text-5xl font-bold text-white tabular-nums mb-2">{approvals.pendingApprovals || 0}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-bold">Pending Requests</div>
      </div>
    </div>
  );
}
