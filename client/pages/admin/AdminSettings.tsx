import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    };
    
    updateMutation.mutate(data);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-hotel-gold" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Hotel Settings</h1>
          <p className="text-hotel-black/60">Configure public website details and booking policies</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6">
        <Tabs defaultValue="general">
          <TabsList className="mb-6 bg-gray-100">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="contact">Contact & Location</TabsTrigger>
            <TabsTrigger value="booking">Booking Policies</TabsTrigger>
            <TabsTrigger value="social">Social & SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hotel Name</label>
                <Input name="hotelName" required defaultValue={settings?.hotelName} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tagline</label>
                <Input name="tagline" defaultValue={settings?.tagline} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Short Description</label>
                <textarea 
                  name="description" 
                  className="w-full border rounded-md p-2 text-sm min-h-[100px]" 
                  defaultValue={settings?.description}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Logo URL</label>
                <Input name="logoUrl" defaultValue={settings?.logoUrl} placeholder="https://..." />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input name="phone" required defaultValue={settings?.phone} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input name="email" type="email" required defaultValue={settings?.email} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Number</label>
                <Input name="whatsappNumber" defaultValue={settings?.whatsappNumber} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Physical Address</label>
                <Input name="address" required defaultValue={settings?.address} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Google Maps URL</label>
                <Input name="googleMapsUrl" defaultValue={settings?.googleMapsUrl} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="booking" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Check-in Time</label>
                <Input name="checkInTime" type="time" required defaultValue={settings?.checkInTime} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Check-out Time</label>
                <Input name="checkOutTime" type="time" required defaultValue={settings?.checkOutTime} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency Code</label>
                <Input name="currency" required defaultValue={settings?.currency} placeholder="INR" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">GST Percentage (%)</label>
                <Input name="gstPercentage" type="number" step="0.1" required defaultValue={settings?.gstPercentage} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Cancellation Policy</label>
                <textarea 
                  name="cancellationPolicy" 
                  required 
                  className="w-full border rounded-md p-2 text-sm min-h-[100px]" 
                  defaultValue={settings?.cancellationPolicy}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Instagram URL</label>
                <Input name="instagramUrl" defaultValue={settings?.instagramUrl} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Facebook URL</label>
                <Input name="facebookUrl" defaultValue={settings?.facebookUrl} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">YouTube URL</label>
                <Input name="youtubeUrl" defaultValue={settings?.youtubeUrl} />
              </div>
              
              <div className="col-span-2 pt-4 border-t">
                <h3 className="font-semibold mb-4">SEO Configuration</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Meta Title</label>
                <Input name="metaTitle" defaultValue={settings?.metaTitle} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">OG Image URL</label>
                <Input name="ogImageUrl" defaultValue={settings?.ogImageUrl} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Meta Description</label>
                <textarea 
                  name="metaDescription" 
                  className="w-full border rounded-md p-2 text-sm min-h-[80px]" 
                  defaultValue={settings?.metaDescription}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 pt-6 border-t flex justify-end">
          <Button type="submit" className="bg-hotel-black text-white hover:bg-gray-800 flex items-center gap-2" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
