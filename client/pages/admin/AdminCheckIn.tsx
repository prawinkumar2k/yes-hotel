import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { LogIn, LogOut, Search, User, Calendar, Home, Loader2, ArrowLeft } from "lucide-react";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function AdminCheckIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");

  // Bookings confirmed and arriving today or overdue
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["checkInBookings", search],
    queryFn: () =>
      apiFetch(
        `/api/admin/bookings?status=CONFIRMED&search=${encodeURIComponent(search)}`,
        user?.token
      ),
  });

  // Available rooms for assigning
  const { data: roomsData } = useQuery({
    queryKey: ["availableRooms"],
    queryFn: () => apiFetch("/api/rooms", user?.token),
    enabled: !!selectedBooking,
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId: string }) =>
      apiFetch(`/api/bookings/${id}/check-in`, user?.token, "POST", { roomId }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "✅ Checked In", description: `Booking ${selectedBooking?.bookingReference} successfully checked in.` });
        setSelectedBooking(null);
        setSelectedRoomId("");
        queryClient.invalidateQueries({ queryKey: ["checkInBookings"] });
        queryClient.invalidateQueries({ queryKey: ["availableRooms"] });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const bookings = bookingsData?.data?.bookings ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="font-semibold text-gray-900 flex items-center gap-2">
            <LogIn size={18} className="text-green-600" /> Check-In Management
          </h1>
        </div>
        <Link to="/admin/check-out" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <LogOut size={16} /> Go to Check-Out →
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking List */}
          <div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Find Confirmed Booking</p>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or booking reference..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[500px]">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No confirmed bookings found.</div>
                ) : (
                  bookings.map((b: any) => (
                    <button
                      key={b._id}
                      onClick={() => { setSelectedBooking(b); setSelectedRoomId(""); }}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedBooking?._id === b._id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{b.guestDetails.firstName} {b.guestDetails.lastName}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{b.bookingReference}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">{format(new Date(b.checkInDate), "MMM dd")}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 rounded-full">CONFIRMED</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{b.roomCategory?.name} · {b.adults} Adult(s)</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Check-In Panel */}
          <div>
            {selectedBooking ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-green-50 border-b border-green-100 px-6 py-4">
                  <h2 className="font-semibold text-green-800 flex items-center gap-2">
                    <LogIn size={18} /> Process Check-In
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  {/* Guest Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Guest</p>
                      <p className="font-medium text-gray-900">{selectedBooking.guestDetails.firstName} {selectedBooking.guestDetails.lastName}</p>
                      <p className="text-gray-500">{selectedBooking.guestDetails.email}</p>
                      <p className="text-gray-500">{selectedBooking.guestDetails.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Stay</p>
                      <p className="font-medium text-gray-900">{selectedBooking.roomCategory?.name}</p>
                      <p className="text-gray-500 flex items-center gap-1"><Calendar size={12} /> {format(new Date(selectedBooking.checkInDate), "MMM dd")} → {format(new Date(selectedBooking.checkOutDate), "MMM dd, yyyy")}</p>
                      <p className="text-gray-500">{selectedBooking.adults} Adult(s), {selectedBooking.children} Child(ren)</p>
                    </div>
                  </div>

                  {/* Assign Room */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Home size={14} className="inline mr-1" /> Assign Physical Room *
                    </label>
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">— Select an available room —</option>
                      {(roomsData?.data ?? [])
                        .filter((r: any) => r.status === "AVAILABLE" && r.category === selectedBooking.roomCategory?._id)
                        .map((r: any) => (
                          <option key={r._id} value={r._id}>Room {r.roomNumber} — Floor {r.floor}</option>
                        ))}
                    </select>
                    {roomsData?.data?.filter((r: any) => r.status === "AVAILABLE" && r.category === selectedBooking.roomCategory?._id).length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">⚠️ No available rooms in this category. Check room inventory.</p>
                    )}
                  </div>

                  {/* Special Requests */}
                  {selectedBooking.specialRequests && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                      <p className="text-xs font-semibold text-amber-700 mb-1">SPECIAL REQUESTS</p>
                      <p className="text-amber-800">{selectedBooking.specialRequests}</p>
                    </div>
                  )}

                  <button
                    disabled={!selectedRoomId || checkInMutation.isPending}
                    onClick={() => checkInMutation.mutate({ id: selectedBooking._id, roomId: selectedRoomId })}
                    className="w-full bg-green-600 text-white py-3 rounded font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {checkInMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Confirm Check-In
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-full min-h-[300px] text-center text-gray-400">
                <div>
                  <User size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Select a booking from the list to process check-in.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
