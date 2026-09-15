import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LogIn, LogOut, BedDouble, CreditCard, UtensilsCrossed,
  Sparkles, DollarSign, CalendarDays, Plus, UserPlus
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuickActionModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  const handleAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const ACTIONS = [
    {
      title: "New Reservation / Walk-In",
      desc: "Create instant walk-in booking or reserve future dates",
      icon: CalendarDays,
      path: "/admin/bookings",
      color: "from-amber-500/20 to-hotel-gold/10 text-hotel-gold border-hotel-gold/30",
    },
    {
      title: "Express Check-In",
      desc: "Assign clean room, verify KYC & activate stay",
      icon: LogIn,
      path: "/admin/check-in",
      color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
    },
    {
      title: "Check-Out & Settle Folio",
      desc: "Review charges, collect balance & trigger housekeeping",
      icon: LogOut,
      path: "/admin/check-out",
      color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
    },
    {
      title: "Receive Advance Payment",
      desc: "Record deposit via UPI, Card or Cash with receipt",
      icon: CreditCard,
      path: "/admin/advances",
      color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
    },
    {
      title: "Open Room Rack 2.0",
      desc: "Live floor grid, room availability & quick assignment",
      icon: BedDouble,
      path: "/admin/room-rack",
      color: "from-hotel-gold/20 to-amber-600/10 text-hotel-gold border-hotel-gold/30",
    },
    {
      title: "Restaurant POS & KDS",
      desc: "Enter KOT docket, charge to room folio or cash bill",
      icon: UtensilsCrossed,
      path: "/admin/pos",
      color: "from-orange-500/20 to-red-500/10 text-orange-400 border-orange-500/30",
    },
    {
      title: "Housekeeping Board",
      desc: "Inspect rooms, manage cleaning queue & release clean",
      icon: Sparkles,
      path: "/admin/housekeeping",
      color: "from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30",
    },
    {
      title: "Cashier Shift Drawer",
      desc: "Count float, record cash sales & balance shift",
      icon: DollarSign,
      path: "/admin/cashier-shifts",
      color: "from-green-500/20 to-emerald-500/10 text-green-400 border-green-500/30",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#121316] text-white border border-white/10 p-6 shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="font-serif text-xl text-white flex items-center gap-2">
            <Plus className="text-hotel-gold" /> Quick Hotel Operations
          </DialogTitle>
          <p className="text-xs text-zinc-400">
            Launch core front desk, folio, and operational workflows with one click
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                onClick={() => handleAction(action.path)}
                className={`p-4 rounded-xl border bg-gradient-to-br ${action.color} hover:scale-[1.02] cursor-pointer transition-all duration-200 flex items-start gap-3`}
              >
                <div className="p-2.5 rounded-lg bg-black/40 shrink-0">
                  <Icon size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide">{action.title}</h4>
                  <p className="text-xs text-zinc-300/80 mt-1 leading-relaxed">{action.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
