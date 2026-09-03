import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function AdminTestimonials() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    rating: 5,
    comment: "",
    avatar: "",
    displayOrder: 0,
    isPublished: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const res = await api.get("/testimonials");
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/testimonials", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Success", description: "Testimonial created successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to create", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await api.patch(`/testimonials/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Success", description: "Testimonial updated successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/testimonials/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Success", description: "Testimonial deleted successfully" });
    }
  });

  const handleOpen = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        location: item.location || "",
        rating: item.rating,
        comment: item.comment,
        avatar: item.avatar || "",
        displayOrder: item.displayOrder,
        isPublished: item.isPublished
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        location: "",
        rating: 5,
        comment: "",
        avatar: "",
        displayOrder: 0,
        isPublished: true
      });
    }
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Testimonial CMS</h1>
          <p className="text-hotel-black/60">Manage guest reviews on the website</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-hotel-gold hover:bg-hotel-gold/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Testimonial
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((item: any) => (
          <Card key={item._id} className={!item.isPublished ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold">{item.name}</CardTitle>
                  <p className="text-sm text-hotel-black/60">{item.location}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => handleOpen(item)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" className="text-red-500" onClick={() => {
                    if (confirm("Are you sure you want to delete this testimonial?")) deleteMutation.mutate(item._id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex items-center text-yellow-500 my-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < item.rating ? "fill-current" : "text-gray-300"}`} />
                ))}
              </div>
              <div className="text-xs text-hotel-black/50">
                Order: {item.displayOrder} | {item.isPublished ? "Published" : "Draft"}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-hotel-black/80 italic">"{item.comment}"</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.length === 0 && (
        <div className="text-center p-12 text-hotel-black/50 border rounded-lg bg-white">
          No testimonials found. Add one to get started.
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest Name</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rating (1-5)</Label>
                <Input 
                  type="number" 
                  min="1" max="5"
                  value={formData.rating} 
                  onChange={e => setFormData({...formData, rating: parseInt(e.target.value) || 5})} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input 
                  type="number" 
                  value={formData.displayOrder} 
                  onChange={e => setFormData({...formData, displayOrder: parseInt(e.target.value) || 0})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea 
                value={formData.comment} 
                onChange={e => setFormData({...formData, comment: e.target.value})} 
                required 
                rows={4}
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                checked={formData.isPublished} 
                onCheckedChange={(c) => setFormData({...formData, isPublished: c})} 
              />
              <Label>Published (Visible on Homepage)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-hotel-gold hover:bg-hotel-gold/90 text-white" disabled={createMutation.isPending || updateMutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
