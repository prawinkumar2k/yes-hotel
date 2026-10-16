import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRoomCategories } from "@/hooks/use-room-categories";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Filter, MessageSquare, Briefcase, Phone, Mail, Calendar, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enquiryStageInfo } from "@shared/enquiry-stages";
import { useStaffRealtime } from "@/hooks/useStaffRealtime";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUSES = ["ALL", "NEW", "CONTACTED", "FOLLOW_UP", "QUOTATION_SENT", "AWAITING_RESPONSE", "CONVERTED", "LOST", "CANCELLED"];
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

const STAGE_TONE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-300",
  purple: "bg-purple-100 text-purple-800 border-purple-300",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  amber: "bg-amber-100 text-amber-800 border-amber-300 font-semibold",
  rose: "bg-rose-100 text-rose-800 border-rose-300 font-semibold",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-300",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
};

export default function AdminEnquiries() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["booking-enquiries", page, status, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        ...(status !== "ALL" && { status }),
        ...(search && { search }),
      });
      const res = await api.get(`/admin/booking-enquiries?${params}`);
      return res.data.data;
    },
  });

  // New website / chatbot leads and stage changes appear without refreshing.
  useStaffRealtime((event) => {
    if (event === "enquiry:updated") queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/booking-enquiries/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
      toast({ title: "Success", description: "Enquiry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Booking Enquiries</h1>
          <p className="text-gray-500 mt-1">Manage leads, quotations, and booking conversions</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-hotel-gold hover:bg-hotel-gold/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          New Enquiry
        </Button>
      </div>

      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-serif text-hotel-black">{data.stats.totalAll}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">New</p>
            <p className="text-2xl font-serif text-blue-900">{data.stats.newCount}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">Follow-up</p>
            <p className="text-2xl font-serif text-amber-900">{data.stats.followUpCount}</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Quoted</p>
            <p className="text-2xl font-serif text-indigo-900">{data.stats.quotationCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Converted</p>
            <p className="text-2xl font-serif text-green-900">{data.stats.convertedCount}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
            <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Overdue</p>
            <p className="text-2xl font-serif text-red-900">{data.stats.overdue}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={status === s ? "bg-hotel-black text-white hover:bg-gray-800" : "bg-white"}
            >
              {s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search name, phone, email..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 border-b text-gray-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Enquiry</th>
                <th className="px-6 py-4">Guest Contact</th>
                <th className="px-6 py-4">Requirements</th>
                <th className="px-6 py-4">Stage of Booking</th>
                <th className="px-6 py-4">Status & Next Step</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
              ) : data?.enquiries?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                      <MessageSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">No enquiries found</p>
                    <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                data?.enquiries?.map((enq: any) => {
                  const info = enquiryStageInfo(enq.bookingStage);
                  const stage = { label: info.label, desc: info.desc, color: STAGE_TONE[info.tone] };
                  return (
                    <tr key={enq._id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer" onClick={(e) => {
                      // Prevent navigation if clicking actions
                      if ((e.target as HTMLElement).closest('.actions-cell')) return;
                      navigate(`/admin/enquiries/${enq._id}`);
                    }}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-hotel-black">{enq.enquiryNumber}</div>
                        <div className="text-gray-500 flex items-center mt-1">
                          {enq.enquiryType === 'GROUP' || enq.enquiryType === 'EVENT' ? (
                            <><Briefcase className="w-3 h-3 mr-1" /> {enq.enquiryType}</>
                          ) : (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{enq.source}</span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs mt-1">{format(new Date(enq.createdAt), "dd MMM yy")}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-hotel-black">{enq.guestName}</div>
                        <div className="text-gray-500 flex items-center gap-2 mt-1">
                          <Phone className="w-3 h-3" /> {enq.phone}
                        </div>
                        {enq.email && (
                          <div className="text-gray-500 flex items-center gap-2 mt-0.5">
                            <Mail className="w-3 h-3" /> <span className="truncate max-w-[150px]">{enq.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-hotel-black flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {format(new Date(enq.checkIn), "dd MMM")} - {format(new Date(enq.checkOut), "dd MMM")}
                        </div>
                        <div className="text-gray-500 mt-1">
                          {enq.rooms} {enq.roomType} · {enq.adults}A {enq.children}C
                        </div>
                        {enq.convertedToBookingId && (
                          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            Res: {enq.convertedToBookingId.bookingReference}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`font-medium border ${stage.color}`}>
                          {stage.label}
                        </Badge>
                        <p className="text-[11px] text-gray-500 mt-1 max-w-[180px] leading-tight">{stage.desc}</p>
                        {enq.lastActivityAt && enq.status !== "CONVERTED" && (
                          <p className="text-[11px] text-gray-400 mt-0.5">Last active {formatDistanceToNowStrict(new Date(enq.lastActivityAt), { addSuffix: true })}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`font-medium ${STATUS_COLORS[enq.status] || STATUS_COLORS.NEW}`}>
                          {enq.status.replace(/_/g, " ")}
                        </Badge>
                        {enq.followUpOverdue && (
                          <div className="text-xs mt-2 font-bold text-red-600">Follow-up overdue</div>
                        )}
                        {enq.nextFollowUpDate && enq.status !== 'CONVERTED' && enq.status !== 'LOST' && enq.status !== 'CANCELLED' && (
                          <div className={`text-xs mt-2 font-medium ${enq.followUpOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                            Follow-up: {format(new Date(enq.nextFollowUpDate), "dd MMM, HH:mm")}
                          </div>
                        )}
                      </td>
                    <td className="px-6 py-4 text-right actions-cell">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/enquiries/${enq._id}`)} title="View Details">
                          <Eye className="h-4 w-4 text-gray-500 hover:text-hotel-black" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this enquiry permanently?")) {
                              deleteMutation.mutate(enq._id);
                            }
                          }}
                          title="Delete"
                          disabled={enq.status === 'CONVERTED'}
                        >
                          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {data?.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-gray-50/50">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm font-medium text-gray-500">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <CreateEnquiryDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}

function CreateEnquiryDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    guestName: "", phone: "", email: "", checkIn: "", checkOut: "",
    adults: 1, children: 0, rooms: 1, roomType: "To be assigned", roomCategoryId: "",
    enquiryType: "INDIVIDUAL", source: "PHONE", notes: ""
  });

  const { data: categories = [] } = useRoomCategories();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { roomCategoryId, ...rest } = formData;
      await api.post("/admin/booking-enquiries", roomCategoryId ? formData : rest);
      toast({ title: "Success", description: "Enquiry created successfully" });
      queryClient.invalidateQueries({ queryKey: ["booking-enquiries"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to create enquiry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New Enquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Guest Name <span className="text-red-500">*</span></label>
              <Input required value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
              <Input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Source</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}
              >
                <option value="PHONE">Phone Call</option>
                <option value="EMAIL">Email</option>
                <option value="WALK_IN">Walk In</option>
                <option value="WEBSITE">Website (Direct)</option>
                <option value="OTA">OTA</option>
                <option value="CORPORATE">Corporate</option>
                <option value="REFERRAL">Referral</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div className="col-span-2 pt-4 border-t">
              <h4 className="text-sm font-medium text-hotel-black mb-4">Stay Details</h4>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Check In <span className="text-red-500">*</span></label>
              <Input required type="date" value={formData.checkIn} onChange={e => setFormData({...formData, checkIn: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Check Out <span className="text-red-500">*</span></label>
              <Input required type="date" value={formData.checkOut} onChange={e => setFormData({...formData, checkOut: e.target.value})} />
            </div>

            <div className="grid grid-cols-3 gap-2 col-span-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rooms</label>
                <Input type="number" min="1" value={formData.rooms} onChange={e => setFormData({...formData, rooms: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Adults</label>
                <Input type="number" min="1" value={formData.adults} onChange={e => setFormData({...formData, adults: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Children</label>
                <Input type="number" min="0" value={formData.children} onChange={e => setFormData({...formData, children: parseInt(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Room Type</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.roomCategoryId}
                onChange={e => {
                  const c = categories.find(x => x._id === e.target.value);
                  setFormData({ ...formData, roomCategoryId: e.target.value, roomType: c?.name ?? "To be assigned" });
                }}
              >
                <option value="">To be assigned</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Enquiry Type</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.enquiryType} onChange={e => setFormData({...formData, enquiryType: e.target.value})}
              >
                <option value="INDIVIDUAL">Individual Stay</option>
                <option value="CORPORATE">Corporate</option>
                <option value="GROUP">Group</option>
                <option value="EVENT">Event</option>
                <option value="BANQUET">Banquet</option>
              </select>
            </div>

            <div className="col-span-2 space-y-2 pt-2">
              <label className="text-sm font-medium text-gray-700">Initial Notes</label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                placeholder="Any special requirements or notes from the initial contact..."
                value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-hotel-black text-white hover:bg-gray-800">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Enquiry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
