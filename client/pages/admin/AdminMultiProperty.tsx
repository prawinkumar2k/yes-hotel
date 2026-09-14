import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, Globe } from "lucide-react";

const CHANNELS = ["BOOKING_COM", "AGODA", "MAKE_MY_TRIP", "STAAH", "GOIBIBO", "AIRBNB", "DIRECT"];
const CHANNEL_LABELS: Record<string, string> = {
  BOOKING_COM: "Booking.com", AGODA: "Agoda", MAKE_MY_TRIP: "MakeMyTrip",
  STAAH: "STAAH", GOIBIBO: "Goibibo", AIRBNB: "Airbnb", DIRECT: "Direct",
};
const CHANNEL_COLORS: Record<string, string> = {
  BOOKING_COM: "bg-blue-100 text-blue-800", AGODA: "bg-red-100 text-red-800",
  MAKE_MY_TRIP: "bg-orange-100 text-orange-800", STAAH: "bg-green-100 text-green-800",
  GOIBIBO: "bg-purple-100 text-purple-800", AIRBNB: "bg-pink-100 text-pink-800",
  DIRECT: "bg-gray-100 text-gray-800",
};

export default function AdminMultiProperty() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => { const r = await api.get("/properties"); return r.data.data; },
  });

  const { data: roomCategories = [] } = useQuery({
    queryKey: ["room-categories"],
    queryFn: async () => { const r = await api.get("/rooms/categories"); return r.data.data; },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["channel-mappings", selectedPropertyId],
    queryFn: async () => {
      const qs = selectedPropertyId ? `?propertyId=${selectedPropertyId}` : "";
      const r = await api.get(`/properties/channels${qs}`);
      return r.data.data;
    },
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post("/properties", data); return r.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["properties"] }); setAddPropertyOpen(false); toast({ title: "Property created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.response?.data?.message, variant: "destructive" }),
  });

  const togglePropertyMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.patch(`/properties/${id}/toggle-active`, {}); return r.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });

  const upsertMappingMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post("/properties/channels", data); return r.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-mappings"] }); setAddMappingOpen(false); toast({ title: "Channel mapping saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.response?.data?.message, variant: "destructive" }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/properties/channels/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel-mappings"] }); toast({ title: "Mapping deleted" }); },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.post(`/properties/channels/${id}/sync`, {}); return r.data; },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["channel-mappings"] }); toast({ title: "Sync completed", description: d.message }); },
  });

  return (
    <div className="space-y-8 p-2">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Property & OTA Channel Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage properties and distribution channel mappings</p>
        </div>
        <Button onClick={() => setAddPropertyOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Property
        </Button>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.map((p: any) => (
          <Card key={p._id}
            className={`cursor-pointer transition-all ${selectedPropertyId === p._id ? "ring-2 ring-indigo-500" : ""} ${!p.isActive ? "opacity-60" : ""}`}
            onClick={() => setSelectedPropertyId(p._id === selectedPropertyId ? null : p._id)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </div>
                <div className="flex gap-1.5">
                  {p.isHeadOffice && <Badge className="bg-amber-100 text-amber-800 text-xs">Head Office</Badge>}
                  <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-mono text-xs text-indigo-600">{p.code}</p>
              <p className="text-muted-foreground">{p.city}, {p.state}</p>
              <p className="text-muted-foreground">{p.phone}</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">{p.totalRooms} rooms · {p.currency}</span>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePropertyMutation.mutate(p._id); }}>
                  {p.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {properties.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Building2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p>No properties yet. Add your first property above.</p>
          </div>
        )}
      </div>

      {/* Channel Mappings */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" /> OTA Channel Mappings
              {selectedPropertyId && <Badge variant="outline" className="ml-2">Filtered by property</Badge>}
            </CardTitle>
            <Button size="sm" onClick={() => setAddMappingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Mapping
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No channel mappings{selectedPropertyId ? " for this property" : ""}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Property</th>
                    <th className="p-3 text-left font-medium">Room Category</th>
                    <th className="p-3 text-left font-medium">Channel</th>
                    <th className="p-3 text-left font-medium">Channel Room ID</th>
                    <th className="p-3 text-left font-medium">Markup</th>
                    <th className="p-3 text-left font-medium">Last Sync</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mappings.map((m: any) => (
                    <tr key={m._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{m.propertyId?.code || "—"}</td>
                      <td className="p-3">{m.roomCategoryId?.name || "—"}</td>
                      <td className="p-3">
                        <Badge className={CHANNEL_COLORS[m.channel] || "bg-gray-100 text-gray-800"}>
                          {CHANNEL_LABELS[m.channel] || m.channel}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{m.channelRoomTypeId}</td>
                      <td className="p-3">{m.markupPercent}%</td>
                      <td className="p-3">
                        {m.lastSyncedAt ? (
                          <div>
                            <div className="text-xs">{new Date(m.lastSyncedAt).toLocaleDateString()}</div>
                            <Badge variant={m.lastSyncStatus === "SUCCESS" ? "secondary" : "destructive"} className="text-xs">
                              {m.lastSyncStatus}
                            </Badge>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">Never</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title="Sync" onClick={() => syncMutation.mutate(m._id)} disabled={syncMutation.isPending}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (confirm("Delete this mapping?")) deleteMappingMutation.mutate(m._id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Property Dialog */}
      <Dialog open={addPropertyOpen} onOpenChange={setAddPropertyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add New Property</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            createPropertyMutation.mutate(Object.fromEntries(fd));
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-sm font-medium">Property Name *</label><Input name="name" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Property Code *</label><Input name="code" placeholder="e.g. YES-HYD" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Legal Name</label><Input name="legalName" /></div>
              <div className="space-y-1"><label className="text-sm font-medium">GSTIN</label><Input name="gstin" /></div>
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Address Line 1 *</label><Input name="addressLine1" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">City *</label><Input name="city" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">State *</label><Input name="state" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Pincode *</label><Input name="pincode" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Phone *</label><Input name="phone" required /></div>
              <div className="col-span-2 space-y-1"><label className="text-sm font-medium">Email *</label><Input name="email" type="email" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Total Rooms</label><Input name="totalRooms" type="number" defaultValue={0} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Star Rating</label>
                <select name="starRating" className="w-full border rounded-md p-2 text-sm">
                  {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} Star</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createPropertyMutation.isPending}>Create Property</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Channel Mapping Dialog */}
      <Dialog open={addMappingOpen} onOpenChange={setAddMappingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Channel Mapping</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            upsertMappingMutation.mutate(Object.fromEntries(fd));
          }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Property *</label>
              <select name="propertyId" required className="w-full border rounded-md p-2 text-sm">
                <option value="">Select property...</option>
                {properties.map((p: any) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Room Category *</label>
              <select name="roomCategoryId" required className="w-full border rounded-md p-2 text-sm">
                <option value="">Select category...</option>
                {roomCategories.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Channel *</label>
              <select name="channel" required className="w-full border rounded-md p-2 text-sm">
                {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-sm font-medium">Channel Room Type ID *</label><Input name="channelRoomTypeId" required /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Channel Rate Plan ID</label><Input name="channelRatePlanId" /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Channel Property ID</label><Input name="channelPropertyId" /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Markup %</label><Input name="markupPercent" type="number" defaultValue={0} /></div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={upsertMappingMutation.isPending}>Save Mapping</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
