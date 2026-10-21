import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { HOTEL } from "@shared/hotel-info";

export default function AdminSettings() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch("/settings", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Success", description: "Settings updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update settings", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(fd.entries());
    
    const data = {
      ...rawData,
      gstNumber: String(rawData.gstNumber ?? "").trim().toUpperCase(),
      taxInclusiveRates: fd.get("taxInclusiveRates") === "on",
      onlineBookingOpen: fd.get("onlineBookingOpen") === "on",
      autoNightAuditEnabled: fd.get("autoNightAuditEnabled") === "on",
      autoNightAuditTime: String(fd.get("autoNightAuditTime") || "00:05"),
      extraPersonRate: Number(rawData.extraPersonRate),
      extraBedRate: Number(rawData.extraBedRate),
      earlyCheckInFee: Number(rawData.earlyCheckInFee) || 0,
      lateCheckOutFee: Number(rawData.lateCheckOutFee) || 0,
      childRateNoBed: Number(rawData.childRateNoBed),
      childRateWithBed: Number(rawData.childRateWithBed),
      mealPlanRates: {
        EP: Number(rawData['mealPlanRates.EP']),
        CP: Number(rawData['mealPlanRates.CP']),
        MAP: Number(rawData['mealPlanRates.MAP']),
        AP: Number(rawData['mealPlanRates.AP']),
        RO: Number(rawData['mealPlanRates.RO']),
        BB: Number(rawData['mealPlanRates.BB']),
      }
    };
    
    updateMutation.mutate(data);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-hotel-gold" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-white font-bold">Hotel Settings & Configuration</h1>
          <p className="text-gray-200 text-sm font-medium">Configure public website details, hotel contact, and guest booking policies</p>
        </div>
        <Link to="/admin/settings/payment-channels">
          <Button variant="outline" className="bg-white text-hotel-black hover:bg-gray-100 font-semibold border-none shadow-md">
            Manage Payment Channels
          </Button>
        </Link>
      </div>

      <form key={settings?.updatedAt ?? "new"} onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-300 p-6 text-black">
        <Tabs defaultValue="general">
          <TabsList className="mb-6 bg-gray-200 border border-gray-300 p-1 w-full justify-start overflow-x-auto md:w-auto">
            <TabsTrigger value="general" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">General Info</TabsTrigger>
            <TabsTrigger value="contact" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Contact & Location</TabsTrigger>
            <TabsTrigger value="booking" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Booking Policies</TabsTrigger>
            <TabsTrigger value="mealplans" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Meal Plan Tariffs</TabsTrigger>
            <TabsTrigger value="occupancy" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Occupancy Tariffs</TabsTrigger>
          </TabsList>

          <TabsContent forceMount value="general" className="space-y-4 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Hotel Name</label>
                <Input name="hotelName" required defaultValue={settings?.hotelName} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Tagline</label>
                <Input name="tagline" defaultValue={settings?.tagline} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Short Description</label>
                <textarea 
                  name="description" 
                  className="w-full border border-gray-400 rounded-md p-2 text-sm text-black font-medium min-h-[100px]" 
                  defaultValue={settings?.description}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Logo Image Web Link</label>
                <Input name="logoUrl" defaultValue={settings?.logoUrl} placeholder="https://..." className="border-gray-400 text-black font-medium" />
              </div>
            </div>
          </TabsContent>

          <TabsContent forceMount value="contact" className="space-y-4 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Phone Number</label>
                <Input name="phone" required defaultValue={settings?.phone} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Email Address</label>
                <Input name="email" type="email" required defaultValue={settings?.email} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">WhatsApp Number</label>
                <Input name="whatsappNumber" defaultValue={settings?.whatsappNumber} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Physical Address</label>
                <Input name="address" required defaultValue={settings?.address} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">GSTIN (printed on invoices)</label>
                <Input name="gstNumber" defaultValue={settings?.gstNumber || HOTEL.gstin} placeholder="29ABCDE1234F1Z5" maxLength={15} className="border-gray-400 text-black font-medium uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Room prices include GST</label>
                <label className="flex min-h-[40px] items-center gap-2 text-sm text-black">
                  <input type="checkbox" name="taxInclusiveRates" defaultChecked={settings?.taxInclusiveRates === true} className="h-4 w-4 accent-[#c9a227]" />
                  The rate is what the guest pays — GST (CGST + SGST) is worked out inside it, not added on top.
                </label>
                <p className="text-xs text-gray-600">Applies to new bookings; existing bookings keep the rule they were made with.</p>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Automatic night audit (end of day)</label>
                <label className="flex min-h-[40px] items-center gap-2 text-sm text-black">
                  <input type="checkbox" name="autoNightAuditEnabled" defaultChecked={settings?.autoNightAuditEnabled !== false} className="h-4 w-4 accent-[#c9a227]" />
                  Close the day automatically after midnight at
                  <input type="time" name="autoNightAuditTime" defaultValue={settings?.autoNightAuditTime || "00:05"} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                </label>
                <p className="text-xs text-gray-600">The business date moves to the new day, overstay nights are charged and arrivals that never came are marked no-show. Late arrivals after this time are booked on the new day.</p>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Online booking on the website</label>
                <label className="flex min-h-[40px] items-center gap-2 text-sm text-black">
                  <input type="checkbox" name="onlineBookingOpen" defaultChecked={settings?.onlineBookingOpen === true} className="h-4 w-4 accent-[#c9a227]" />
                  Accept bookings from the website. Switched off = on hold: guests see a "call us to book" notice and cannot confirm a booking.
                </label>
                <p className="text-xs text-gray-600">Reception can still take bookings, advances and walk-ins as usual.</p>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Google Maps Link</label>
                <Input name="googleMapsUrl" defaultValue={settings?.googleMapsUrl} placeholder="https://maps.google.com/..." className="border-gray-400 text-black font-medium" />
              </div>
            </div>
          </TabsContent>

          <TabsContent forceMount value="booking" className="space-y-4 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Check-in Time</label>
                <Input name="checkInTime" type="time" required defaultValue={settings?.checkInTime} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Check-out Time</label>
                <Input name="checkOutTime" type="time" required defaultValue={settings?.checkOutTime} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Currency Code</label>
                <Input name="currency" required defaultValue={settings?.currency} placeholder="INR" className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">
                  GST rules in force {settings?.gstRulesSource === "DEFAULT" ? "(built-in defaults)" : "(from settings)"}
                </label>
                <ul className="text-sm text-black space-y-1">
                  {(settings?.effectiveGstRules ?? []).map((r: any) => (
                    <li key={`${r.category}-${r.effectiveFrom}`}>
                      <span className="font-semibold">{r.category}</span> from {r.effectiveFrom}{r.effectiveTo ? ` to ${r.effectiveTo}` : ""}:{" "}
                      {r.bands.map((b: any) => (b.upTo === null ? `${b.rate}% above` : `${b.rate}% up to ₹${b.upTo.toLocaleString("en-IN")}/night`)).join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">Split equally into CGST and SGST. Editing slabs comes with Property Settings.</p>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Cancellation Policy</label>
                <textarea 
                  name="cancellationPolicy" 
                  required 
                  className="w-full border border-gray-400 rounded-md p-2 text-sm text-black font-medium min-h-[100px]" 
                  defaultValue={settings?.cancellationPolicy}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent forceMount value="occupancy" className="space-y-4 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Adult Extra Pax (No Bed) - ₹/night</label>
                <Input name="extraPersonRate" type="number" required defaultValue={settings?.extraPersonRate ?? 800} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Adult Extra Pax (With Bed) - ₹/night</label>
                <Input name="extraBedRate" type="number" required defaultValue={settings?.extraBedRate ?? 1200} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Early Check-in Fee - ₹</label>
                <Input name="earlyCheckInFee" type="number" min={0} defaultValue={settings?.earlyCheckInFee ?? 0} className="border-gray-400 text-black font-medium" />
                <p className="text-xs text-gray-600">Used when the room type has no hourly price (Room Types → hourly price × hours otherwise). Staff can change it at the desk.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Late Check-out Fee - ₹</label>
                <Input name="lateCheckOutFee" type="number" min={0} defaultValue={settings?.lateCheckOutFee ?? 0} className="border-gray-400 text-black font-medium" />
                <p className="text-xs text-gray-600">Same rule as early check-in.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Child 3-12 (No Bed) - ₹/night</label>
                <Input name="childRateNoBed" type="number" required defaultValue={settings?.childRateNoBed ?? 400} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Child 3-12 (With Bed) - ₹/night</label>
                <Input name="childRateWithBed" type="number" required defaultValue={settings?.childRateWithBed ?? 600} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 italic">Note: Kids under 3 years are considered free of charge and will not be billed for occupancy.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent forceMount value="mealplans" className="space-y-4 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">EP (Room Only) - ₹/person</label>
                <Input name="mealPlanRates.EP" type="number" required defaultValue={settings?.mealPlanRates?.EP ?? 0} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">CP (Continental / Breakfast) - ₹/person</label>
                <Input name="mealPlanRates.CP" type="number" required defaultValue={settings?.mealPlanRates?.CP ?? 500} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">MAP (Half Board) - ₹/person</label>
                <Input name="mealPlanRates.MAP" type="number" required defaultValue={settings?.mealPlanRates?.MAP ?? 1000} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">AP (Full Board) - ₹/person</label>
                <Input name="mealPlanRates.AP" type="number" required defaultValue={settings?.mealPlanRates?.AP ?? 1500} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">RO (Room Only) - ₹/person</label>
                <Input name="mealPlanRates.RO" type="number" required defaultValue={settings?.mealPlanRates?.RO ?? 0} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">BB (Bed & Breakfast) - ₹/person</label>
                <Input name="mealPlanRates.BB" type="number" required defaultValue={settings?.mealPlanRates?.BB ?? 500} className="border-gray-400 text-black font-medium" />
              </div>
            </div>
          </TabsContent>


        </Tabs>

        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-end">
          <Button type="submit" className="bg-hotel-gold text-black hover:bg-yellow-500 font-bold px-6 py-2.5 flex items-center gap-2 shadow-md" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Save className="w-4 h-4 text-black" />}
            Save All Settings
          </Button>
        </div>
      </form>
    </div>
  );
}

