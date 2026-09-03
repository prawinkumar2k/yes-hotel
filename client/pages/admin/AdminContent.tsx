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
import { Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function AdminContent() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    key: "",
    title: "",
    subtitle: "",
    description: "",
    images: [] as string[],
    isPublished: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: async () => {
      const res = await api.get("/content");
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/content", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast({ title: "Success", description: "Content created successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to create", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await api.patch(`/content/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast({ title: "Success", description: "Content updated successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/content/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      toast({ title: "Success", description: "Content deleted successfully" });
    }
  });

  const handleOpen = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        key: item.key,
        title: item.title || "",
        subtitle: item.subtitle || "",
        description: item.description || "",
        images: item.images || [],
        isPublished: item.isPublished
      });
    } else {
      setEditingItem(null);
      setFormData({
        key: "",
        title: "",
        subtitle: "",
        description: "",
        images: [],
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
          <h1 className="text-3xl font-serif text-hotel-black">Website Content CMS</h1>
          <p className="text-hotel-black/60">Manage static content and copy across the website</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-hotel-gold hover:bg-hotel-gold/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Content Block
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((item: any) => (
          <Card key={item._id} className={!item.isPublished ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold font-mono text-sm">{item.key}</CardTitle>
                  <p className="text-sm font-semibold">{item.title}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => handleOpen(item)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" className="text-red-500" onClick={() => {
                    if (confirm("Are you sure you want to delete this content block?")) deleteMutation.mutate(item._id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="text-xs text-hotel-black/50">
                {item.isPublished ? "Published" : "Draft"} | Images: {item.images.length}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-hotel-black/80 line-clamp-3">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.length === 0 && (
        <div className="text-center p-12 text-hotel-black/50 border rounded-lg bg-white">
          No content blocks found.
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Content Block" : "Add Content Block"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Key (unique identifier, e.g. homepage-hero)</Label>
              <Input 
                value={formData.key} 
                onChange={e => setFormData({...formData, key: e.target.value})} 
                required 
                disabled={!!editingItem} // prevent changing key after creation
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input 
                  value={formData.subtitle} 
                  onChange={e => setFormData({...formData, subtitle: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description / Content</Label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                rows={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Image URLs (comma separated)</Label>
              <Input 
                value={formData.images.join(", ")} 
                onChange={e => setFormData({...formData, images: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})} 
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                checked={formData.isPublished} 
                onCheckedChange={(c) => setFormData({...formData, isPublished: c})} 
              />
              <Label>Published</Label>
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
