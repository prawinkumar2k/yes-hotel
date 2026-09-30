import React from "react";
import { Truck, ArrowRight, PackageOpen, Users } from "lucide-react";
import { Link } from "react-router-dom";

export function ProcurementCommand({ procurement }: { procurement: any }) {
  if (!procurement) return null;

  return (
    <div className="bg-hotel-ivory/30 border border-hotel-charcoal/10 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-hotel-charcoal/5 bg-white">
        <div className="flex items-center gap-2 text-hotel-charcoal font-semibold">
          <Truck size={18} className="text-hotel-gold" />
          Procurement
        </div>
        <Link to="/admin/purchasing" className="text-xs text-semantic-info font-medium flex items-center hover:underline whitespace-nowrap flex-shrink-0">
          View POs <ArrowRight size={14} className="ml-1" />
        </Link>
      </div>
      <div className="p-4 flex-1 bg-white flex justify-around items-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-semantic-warning flex justify-center mb-1">
             <PackageOpen size={28} className="mr-2 opacity-50" />
             {procurement.pendingOrders}
          </div>
          <div className="text-xs text-hotel-charcoal/60 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">Pending POs</div>
        </div>
        
        <div className="w-px h-12 bg-hotel-charcoal/10"></div>
        
        <div className="text-center">
          <div className="text-3xl font-bold text-hotel-charcoal flex justify-center mb-1">
             <Users size={28} className="mr-2 opacity-50" />
             {procurement.supplierCount}
          </div>
          <div className="text-xs text-hotel-charcoal/60 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis font-semibold">Suppliers</div>
        </div>
      </div>
    </div>
  );
}
