import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Calendar, User, Phone, Mail, Clock, MessageSquare, Plus, FileText, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { enquiryStageInfo } from "@shared/enquiry-stages";
import { useRoomCategories } from "@/hooks/use-room-categories";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-purple-50 text-purple-700 border-purple-200",
  FOLLOW_UP: "bg-amber-50 text-amber-700 border-amber-200",
  QUOTATION_SENT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  AWAITING_RESPONSE: "bg-orange-50 text-orange-700 border-orange-200",
  CONVERTED: "bg-green-50 text-green-700 border-green-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function AdminEnquiryDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const { data: enquiry, isLoading } = useQuery({
    queryKey: ["booking-enquiry", id],
    queryFn: async () => {
      const res = await api.get(`/admin/booking-enquiries/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, lostReason }: { status: string, lostReason?: string }) => {
      const res = await api.patch(`/admin/booking-enquiries/${id}/status`, { status, lostReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-enquiry", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
      toast({ title: "Status Updated", description: "The enquiry status has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update status", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-hotel-gold" /></div>;
  }

  if (!enquiry) {
    return <div className="p-12 text-center text-gray-500">Enquiry not found</div>;
  }

  const isClosed = ["CONVERTED", "LOST", "CANCELLED"].includes(enquiry.status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/enquiries")} className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif text-hotel-black">{enquiry.enquiryNumber}</h1>
              <Badge variant="outline" className={`font-medium ${STATUS_COLORS[enquiry.status]}`}>
                {enquiry.status.replace(/_/g, " ")}
              </Badge>
              {enquiry.bookingStage && (
                <Badge variant="outline" className="font-semibold bg-amber-50 text-amber-800 border-amber-300">
                  Stage: {enquiryStageInfo(enquiry.bookingStage).label}
                </Badge>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">Received {format(new Date(enquiry.createdAt), "PPP 'at' p")} via {enquiry.source}</p>
          </div>
        </div>
        
        {!isClosed && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsFollowUpOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Follow-up
            </Button>
            <Button 
              className="bg-green-600 text-white hover:bg-green-700" 
              onClick={() => setIsConvertOpen(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Convert to Booking
            </Button>
          </div>
        )}
      </div>

      {enquiry.convertedToBookingId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Successfully Converted</p>
              <p className="text-sm text-green-600">This enquiry was converted to booking {enquiry.convertedToBookingId.bookingReference} on {format(new Date(enquiry.convertedAt), "PPP")}</p>
            </div>
          </div>
          <Button variant="outline" className="bg-white" onClick={() => navigate(`/admin/bookings/${enquiry.convertedToBookingId._id}`)}>
            View Booking
          </Button>
        </div>
      )}

      {enquiry.status === "LOST" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
          <XCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Enquiry Lost</p>
            <p className="text-sm text-red-600">Reason: {enquiry.lostReason || "No reason provided"}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4">
              <h2 className="font-medium text-hotel-black flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" /> Guest Details
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Guest Name</p>
                <p className="text-hotel-black font-medium">{enquiry.guestName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Company</p>
                <p className="text-hotel-black">{enquiry.company || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
                <p className="text-hotel-black">{enquiry.phone}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                <p className="text-hotel-black">{enquiry.email || "—"}</p>
              </div>
            </div>
          </div>

          {enquiry.stageHistory?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/50 p-4">
                <h2 className="font-medium text-hotel-black flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" /> Where the guest got to
                </h2>
                <p className="text-xs text-gray-500 mt-1">{enquiryStageInfo(enquiry.bookingStage).desc}</p>
              </div>
              <ol className="p-5 space-y-3">
                {enquiry.stageHistory.map((h: any, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === enquiry.stageHistory.length - 1 ? "bg-amber-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-medium text-hotel-black">{enquiryStageInfo(h.stage).label}</p>
                      <p className="text-xs text-gray-500">{format(new Date(h.at), "dd MMM yyyy, HH:mm")}{h.reason ? ` · ${h.reason}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4">
              <h2 className="font-medium text-hotel-black flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" /> Stay Requirements
              </h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Check In</p>
                  <p className="text-lg font-medium text-hotel-black">{format(new Date(enquiry.checkIn), "EEE, d MMM yyyy")}</p>
                </div>
                <div className="px-4 py-1 bg-gray-50 rounded-full text-xs font-medium text-gray-500">
                  {enquiry.nights} Night{enquiry.nights !== 1 ? 's' : ''}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Check Out</p>
                  <p className="text-lg font-medium text-hotel-black">{format(new Date(enquiry.checkOut), "EEE, d MMM yyyy")}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rooms</p>
                  <p className="font-medium">{enquiry.rooms} × {enquiry.roomType}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Guests</p>
                  <p className="font-medium">{enquiry.adults} Adults, {enquiry.children} Children</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Enquiry Type</p>
                  <p className="font-medium">{enquiry.enquiryType}</p>
                </div>
              </div>

              {(enquiry.notes || enquiry.specialRequirements) && (
                <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100/50">
                  <h3 className="text-xs font-medium text-amber-800 uppercase tracking-wider mb-2">Initial Notes & Requirements</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{enquiry.specialRequirements || enquiry.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Workflow */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4">
              <h2 className="font-medium text-hotel-black flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> Follow-up History
              </h2>
            </div>
            <div className="p-4">
              {enquiry.nextFollowUpDate && !isClosed && (
                <div className={`mb-6 p-3 rounded-lg border ${new Date(enquiry.nextFollowUpDate) < new Date() ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${new Date(enquiry.nextFollowUpDate) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                    {new Date(enquiry.nextFollowUpDate) < new Date() ? 'Overdue Follow-up' : 'Scheduled Follow-up'}
                  </p>
                  <p className="font-medium text-hotel-black">{format(new Date(enquiry.nextFollowUpDate), "EEE, d MMM yyyy 'at' h:mm a")}</p>
                </div>
              )}

              <div className="space-y-4">
                {enquiry.followUps?.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No follow-up history</p>
                ) : (
                  enquiry.followUps?.map((f: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="mt-0.5 shrink-0">
                        {f.method === "EMAIL" ? <Mail className="h-4 w-4 text-gray-400" /> :
                         f.method === "PHONE" ? <Phone className="h-4 w-4 text-gray-400" /> :
                         <MessageSquare className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-hotel-black">{f.conductedBy?.firstName || "Staff"}</span>
                          <span className="text-xs text-gray-500">{format(new Date(f.date), "dd MMM, HH:mm")}</span>
                        </div>
                        <p className="text-gray-600 mt-1">{f.notes}</p>
                      </div>
                    </div>
                  )).reverse()
                )}
              </div>
            </div>
          </div>

          {!isClosed && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="font-medium text-hotel-black mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => updateStatusMutation.mutate({ status: "QUOTATION_SENT" })}>
                  <FileText className="h-4 w-4 mr-2 text-indigo-500" /> Mark as Quotation Sent
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                  const reason = prompt("Enter reason for losing this enquiry:");
                  if (reason) updateStatusMutation.mutate({ status: "LOST", lostReason: reason });
                }}>
                  <XCircle className="h-4 w-4 mr-2" /> Mark as Lost
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FollowUpDialog enquiryId={id!} open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen} currentStatus={enquiry.status} />
      <ConvertDialog enquiryId={id!} open={isConvertOpen} onOpenChange={setIsConvertOpen} enquiry={enquiry} />
    </div>
  );
}

function FollowUpDialog({ enquiryId, open, onOpenChange, currentStatus }: { enquiryId: string, open: boolean, onOpenChange: (o: boolean) => void, currentStatus: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("PHONE");
  const [notes, setNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/admin/booking-enquiries/${enquiryId}/follow-up`, { method, notes, nextFollowUpDate: nextFollowUpDate || undefined });
      toast({ title: "Follow-up Recorded" });
      queryClient.invalidateQueries({ queryKey: ["booking-enquiry", enquiryId] });
      onOpenChange(false);
      setNotes("");
      setNextFollowUpDate("");
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to save", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Follow-up Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact Method</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="PHONE">Phone Call</option>
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="IN_PERSON">In Person</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Discussion Notes <span className="text-red-500">*</span></label>
            <textarea required className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed?" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule Next Follow-up (Optional)</label>
            <input type="datetime-local" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={nextFollowUpDate} onChange={e => setNextFollowUpDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-hotel-black text-white hover:bg-gray-800">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ enquiryId, open, onOpenChange, enquiry }: { enquiryId: string, open: boolean, onOpenChange: (o: boolean) => void, enquiry: any }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { data: categories = [] } = useRoomCategories();
  const [categoryId, setCategoryId] = useState<string>(enquiry?.roomCategoryId?._id ?? enquiry?.roomCategoryId ?? "");

  const handleConvert = async () => {
    setLoading(true);
    try {
      if (!categoryId) {
        toast({ title: "Room category required", description: "Choose the room category to book.", variant: "destructive" });
        return;
      }
      const res = await api.post(`/admin/booking-enquiries/${enquiryId}/convert`, { roomCategoryId: categoryId });
      toast({ title: "Success", description: res.data.message });
      onOpenChange(false);
      navigate(`/admin/bookings/${res.data.data.booking._id}`);
    } catch (error: any) {
      toast({ title: "Conversion Failed", description: error.response?.data?.message || "Failed to convert enquiry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Enquiry to Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            This will create a new Confirmed booking for <strong>{enquiry.guestName}</strong> from <strong>{format(new Date(enquiry.checkIn), "MMM d")} to {format(new Date(enquiry.checkOut), "MMM d")}</strong> ({enquiry.rooms} rooms).
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Room category</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Choose a room category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Priced with the category rate (or the quotation, if one was sent) plus GST.</p>
          </div>
          <p className="text-sm text-gray-600">
            A guest profile will be automatically linked or created based on the phone number ({enquiry.phone}).
          </p>
          <div className="bg-amber-50 text-amber-800 p-3 rounded text-sm border border-amber-200">
            <strong>Note:</strong> Physical rooms will need to be assigned manually from the Booking Details page after conversion.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={loading} className="bg-green-600 text-white hover:bg-green-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Confirm & Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
