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

export default function AdminFAQs() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "General",
    displayOrder: 0,
    isPublished: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const res = await api.get("/faqs");
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/faqs", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "Success", description: "FAQ created successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to create FAQ", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await api.patch(`/faqs/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "Success", description: "FAQ updated successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update FAQ", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/faqs/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
      toast({ title: "Success", description: "FAQ deleted successfully" });
    }
  });

  const handleOpen = (faq: any = null) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        displayOrder: faq.displayOrder,
        isPublished: faq.isPublished
      });
    } else {
      setEditingFaq(null);
      setFormData({
        question: "",
        answer: "",
        category: "General",
        displayOrder: 0,
        isPublished: true
      });
    }
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-hotel-gold" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">FAQ CMS</h1>
          <p className="text-hotel-black/60">Manage Frequently Asked Questions</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-hotel-gold hover:bg-hotel-gold/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Add FAQ
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((faq: any) => (
          <Card key={faq._id} className={!faq.isPublished ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-bold">{faq.question}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => handleOpen(faq)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" className="text-red-500" onClick={() => {
                    if (confirm("Are you sure you want to delete this FAQ?")) deleteMutation.mutate(faq._id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="text-xs text-hotel-black/50">
                Category: {faq.category} | Order: {faq.displayOrder} | {faq.isPublished ? "Published" : "Draft"}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-hotel-black/80 line-clamp-3">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.length === 0 && (
        <div className="text-center p-12 text-hotel-black/50 border rounded-lg bg-white">
          No FAQs found. Add one to get started.
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input 
                value={formData.question} 
                onChange={e => setFormData({...formData, question: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <Textarea 
                value={formData.answer} 
                onChange={e => setFormData({...formData, answer: e.target.value})} 
                required 
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})} 
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
