import React from "react";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ApprovalCommand({ approvals }: { approvals: any }) {
  if (!approvals) return null;

  return (
    <div className="bg-hotel-ivory/30 border border-hotel-charcoal/10 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-hotel-charcoal/5 bg-white">
        <div className="flex items-center gap-2 text-hotel-charcoal font-semibold">
          <ClipboardCheck size={18} className="text-semantic-special" />
          Task Approvals
        </div>
        <Link to="/admin/approvals" className="text-xs text-semantic-info font-medium flex items-center hover:underline whitespace-nowrap flex-shrink-0">
          Manage <ArrowRight size={14} className="ml-1" />
        </Link>
      </div>
      <div className="p-4 flex-1 bg-white flex flex-col justify-center items-center">
        <div className="text-5xl font-bold text-semantic-special mb-2">{approvals.pendingApprovals}</div>
        <div className="text-sm text-hotel-charcoal/60 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">Pending Approvals</div>
      </div>
    </div>
  );
}
