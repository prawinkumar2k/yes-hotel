import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, subDays, isSameDay } from "date-fns";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Show 14 days by default (2 weeks)
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = addDays(startDate, 13);
  
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "calendar", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const res = await api.get(`/admin/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`);
      return res.data;
    }
  });

  const handlePrevious = () => setCurrentDate(subDays(currentDate, 7));
  const handleNext = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(new Date());

  const days = useMemo(() => {
    const d = [];
    let current = startDate;
    for (let i = 0; i < 14; i++) {
      d.push(current);
      current = addDays(current, 1);
    }
    return d;
  }, [startDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "bg-blue-100 text-blue-800 border-blue-200";
      case "CHECKED_IN": return "bg-green-100 text-green-800 border-green-200";
      case "CHECKED_OUT": return "bg-gray-100 text-gray-800 border-gray-200";
      case "PENDING": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Booking Calendar</h1>
          <p className="text-hotel-black/60">Manage physical room availability and reservations</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday} className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-lg">
            {format(startDate, "MMMM d, yyyy")} - {format(endDate, "MMMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-hotel-gold" />
            </div>
          ) : (
            <div className="min-w-[1000px]">
              {/* Header Row */}
              <div className="flex border-b bg-hotel-ivory/30">
                <div className="w-48 shrink-0 p-4 font-medium border-r sticky left-0 bg-white z-10">
                  Room
                </div>
                {days.map((day, i) => (
                  <div key={i} className={cn(
                    "flex-1 min-w-[100px] p-2 text-center border-r text-sm",
                    isSameDay(day, new Date()) ? "bg-hotel-gold/10 font-bold" : ""
                  )}>
                    <div className="text-hotel-black/60 text-xs">{format(day, "EEE")}</div>
                    <div>{format(day, "d")}</div>
                  </div>
                ))}
              </div>
              
              {/* Rooms Rows */}
              {data?.data?.rooms?.map((room: any) => (
                <div key={room._id} className="flex border-b hover:bg-gray-50/50 transition-colors">
                  <div className="w-48 shrink-0 p-4 border-r sticky left-0 bg-white z-10 group">
                    <div className="font-bold flex items-center justify-between">
                      {room.roomNumber}
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0",
                        room.status === "MAINTENANCE" ? "bg-red-50 text-red-700" :
                        room.status === "CLEANING" ? "bg-orange-50 text-orange-700" : ""
                      )}>
                        {room.status === "AVAILABLE" || room.status === "OCCUPIED" ? room.floor : room.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-hotel-black/60 truncate" title={room.category?.name || "Category"}>
                      {data?.data?.categories?.find((c:any) => c._id === room.category)?.name || "Room"}
                    </div>
                  </div>
                  
                  {/* Days cells */}
                  {days.map((day, dayIdx) => {
                    // Find booking for this room on this day
                    const booking = data?.data?.bookings?.find((b: any) => {
                      if (!b.assignedRoom || b.assignedRoom._id !== room._id) return false;
                      const cIn = new Date(b.checkInDate);
                      const cOut = new Date(b.checkOutDate);
                      cIn.setHours(0,0,0,0);
                      cOut.setHours(0,0,0,0);
                      const current = new Date(day);
                      current.setHours(0,0,0,0);
                      return current >= cIn && current < cOut; // Don't show booking on checkout day morning for next booking
                    });

                    return (
                      <div key={dayIdx} className="flex-1 min-w-[100px] border-r relative p-1">
                        {booking && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link 
                                to={`/admin/bookings/${booking._id}`}
                                className={cn(
                                  "absolute inset-y-1 inset-x-1 rounded text-xs p-1 px-2 border overflow-hidden flex flex-col justify-center",
                                  getStatusColor(booking.status)
                                )}
                              >
                                <span className="font-bold truncate">{booking.guestDetails?.firstName} {booking.guestDetails?.lastName}</span>
                                <span className="text-[10px] opacity-80 truncate">{booking.bookingReference}</span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-bold">{booking.guestDetails?.firstName} {booking.guestDetails?.lastName}</p>
                                <p>Ref: {booking.bookingReference}</p>
                                <p>Status: {booking.status}</p>
                                <p>In: {format(new Date(booking.checkInDate), "MMM d")}</p>
                                <p>Out: {format(new Date(booking.checkOutDate), "MMM d")}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {data?.data?.rooms?.length === 0 && (
                <div className="p-8 text-center text-hotel-black/50">
                  No rooms found in the system.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
