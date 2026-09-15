import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home, BedDouble, CalendarDays, Users, CreditCard, DollarSign,
  UtensilsCrossed, Package, BarChart3, Moon, LogIn, LogOut,
  Wrench, ShieldCheck, Sparkles, Building2, Search, ArrowRight
} from "lucide-react";
import { getStoredAuthToken } from "@/lib/authStorage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    bookings: any[];
    rooms: any[];
    guests: any[];
  }>({ bookings: [], rooms: [], guests: [] });
  const [searching, setSearching] = useState(false);

  // Debounced search for live records
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults({ bookings: [], rooms: [], guests: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const token = getStoredAuthToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [bookingsRes, guestsRes] = await Promise.allSettled([
          fetch(`/api/admin/bookings?search=${encodeURIComponent(query)}&limit=4`, { headers }),
          fetch(`/api/guests?search=${encodeURIComponent(query)}&limit=4`, { headers }),
        ]);

        let bookings: any[] = [];
        let guests: any[] = [];

        if (bookingsRes.status === "fulfilled" && bookingsRes.value.ok) {
          const json = await bookingsRes.value.json();
          if (json.success && json.data?.bookings) {
            bookings = json.data.bookings;
          }
        }

        if (guestsRes.status === "fulfilled" && guestsRes.value.ok) {
          const json = await guestsRes.value.json();
          if (json.success && json.data) {
            guests = Array.isArray(json.data) ? json.data : json.data.guests || [];
          }
        }

        setSearchResults({ bookings, rooms: [], guests });
      } catch (err) {
        console.error("Command palette search failed", err);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-[#121316] text-white border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        <CommandInput
          placeholder="Type a command, guest name, booking ref, or room # (e.g. 101, VIP, check-in)..."
          value={query}
          onValueChange={setQuery}
          className="text-white placeholder:text-zinc-500 bg-transparent border-b border-white/10"
        />
        <CommandList className="max-h-96 text-zinc-300 py-2">
          <CommandEmpty className="py-6 text-center text-sm text-zinc-500">
            {searching ? "Searching hotel records..." : "No operational matches found."}
          </CommandEmpty>

          {/* Dynamic Live Bookings */}
          {searchResults.bookings.length > 0 && (
            <CommandGroup heading="Live Reservations & Folios" className="text-zinc-400">
              {searchResults.bookings.map((b: any) => (
                <CommandItem
                  key={b._id}
                  onSelect={() => handleSelect(() => navigate(`/admin/bookings/${b._id}`))}
                  className="hover:bg-white/10 text-zinc-200 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-hotel-gold" />
                    <span>
                      #{b.bookingReference} — {b.guestDetails?.firstName} {b.guestDetails?.lastName}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {b.assignedRoom ? `Room ${b.assignedRoom.roomNumber}` : b.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic Live Guests */}
          {searchResults.guests.length > 0 && (
            <CommandGroup heading="Guests (CRM)" className="text-zinc-400">
              {searchResults.guests.map((g: any) => (
                <CommandItem
                  key={g._id}
                  onSelect={() => handleSelect(() => navigate(`/admin/guests`))}
                  className="hover:bg-white/10 text-zinc-200 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span>{g.fullName || `${g.firstName} ${g.lastName}`}</span>
                    {g.isVip && <span className="text-[10px] bg-hotel-gold/20 text-hotel-gold px-1.5 py-0.5 rounded font-bold">VIP</span>}
                  </div>
                  <span className="text-xs text-zinc-500">{g.phone || g.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Quick Operational Actions" className="text-zinc-400">
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/check-in"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <LogIn className="mr-2 h-4 w-4 text-emerald-400" />
              <span>Express Check-In Guest</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/check-out"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4 text-blue-400" />
              <span>Check-Out & Settle Folio</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/room-rack"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <BedDouble className="mr-2 h-4 w-4 text-hotel-gold" />
              <span>Open Visual Room Rack</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/advances"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <CreditCard className="mr-2 h-4 w-4 text-amber-400" />
              <span>Receive Advance Payment</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/pos"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <UtensilsCrossed className="mr-2 h-4 w-4 text-purple-400" />
              <span>Open Restaurant POS & KDS</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="bg-white/10" />

          <CommandGroup heading="Hotel Navigation" className="text-zinc-400">
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/dashboard"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Home className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Executive Command Center</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/front-desk"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Front Desk Operations</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/housekeeping"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Housekeeping Floor Board</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/cashier-shifts"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <DollarSign className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Cashier Shifts & Cash Drawer</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/night-audit"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Moon className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Automated Night Audit</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/reports"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <BarChart3 className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Reports & Analytics</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/corporate-accounts"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Building2 className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Corporate Accounts & B2B Billing</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/inventory"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Package className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Inventory & Store Management</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/admin/maintenance"))}
              className="hover:bg-white/10 text-zinc-200 cursor-pointer"
            >
              <Wrench className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Maintenance Work Orders</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="px-4 py-2 border-t border-white/10 text-[11px] text-zinc-500 flex items-center justify-between bg-black/40">
          <span>Use <kbd className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">↑</kbd> <kbd className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">↓</kbd> to navigate, <kbd className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">↵</kbd> to select</span>
          <span><kbd className="bg-white/10 px-1 py-0.5 rounded text-zinc-300">ESC</kbd> to dismiss</span>
        </div>
      </div>
    </CommandDialog>
  );
}
