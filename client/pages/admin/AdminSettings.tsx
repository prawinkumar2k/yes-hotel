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
      gstPercentage: Number(rawData.gstPercentage),
      extraPersonRate: Number(rawData.extraPersonRate),
      extraBedRate: Number(rawData.extraBedRate),
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-300 p-6 text-black">
        <Tabs defaultValue="general">
          <TabsList className="mb-6 bg-gray-200 border border-gray-300 p-1">
            <TabsTrigger value="general" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">General Info</TabsTrigger>
            <TabsTrigger value="contact" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Contact & Location</TabsTrigger>
            <TabsTrigger value="booking" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Booking Policies</TabsTrigger>
            <TabsTrigger value="mealplans" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Meal Plan Tariffs</TabsTrigger>
            <TabsTrigger value="occupancy" className="font-bold data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Occupancy Tariffs</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
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

          <TabsContent value="contact" className="space-y-4">
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
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-bold text-black block">Google Maps Link</label>
                <Input name="googleMapsUrl" defaultValue={settings?.googleMapsUrl} placeholder="https://maps.google.com/..." className="border-gray-400 text-black font-medium" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="booking" className="space-y-4">
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
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">GST Percentage (%)</label>
                <Input name="gstPercentage" type="number" step="0.1" required defaultValue={settings?.gstPercentage} className="border-gray-400 text-black font-medium" />
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

          <TabsContent value="occupancy" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Adult Extra Pax (No Bed) - ₹/night</label>
                <Input name="extraPersonRate" type="number" required defaultValue={settings?.extraPersonRate || 800} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Adult Extra Pax (With Bed) - ₹/night</label>
                <Input name="extraBedRate" type="number" required defaultValue={settings?.extraBedRate || 1200} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Child 3-12 (No Bed) - ₹/night</label>
                <Input name="childRateNoBed" type="number" required defaultValue={settings?.childRateNoBed || 400} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">Child 3-12 (With Bed) - ₹/night</label>
                <Input name="childRateWithBed" type="number" required defaultValue={settings?.childRateWithBed || 600} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 italic">Note: Kids under 3 years are considered free of charge and will not be billed for occupancy.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mealplans" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">EP (Room Only) - ₹/person</label>
                <Input name="mealPlanRates.EP" type="number" required defaultValue={settings?.mealPlanRates?.EP || 0} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">CP (Continental / Breakfast) - ₹/person</label>
                <Input name="mealPlanRates.CP" type="number" required defaultValue={settings?.mealPlanRates?.CP || 500} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">MAP (Half Board) - ₹/person</label>
                <Input name="mealPlanRates.MAP" type="number" required defaultValue={settings?.mealPlanRates?.MAP || 1000} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">AP (Full Board) - ₹/person</label>
                <Input name="mealPlanRates.AP" type="number" required defaultValue={settings?.mealPlanRates?.AP || 1500} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">RO (Room Only) - ₹/person</label>
                <Input name="mealPlanRates.RO" type="number" required defaultValue={settings?.mealPlanRates?.RO || 0} className="border-gray-400 text-black font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block">BB (Bed & Breakfast) - ₹/person</label>
                <Input name="mealPlanRates.BB" type="number" required defaultValue={settings?.mealPlanRates?.BB || 500} className="border-gray-400 text-black font-medium" />
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

