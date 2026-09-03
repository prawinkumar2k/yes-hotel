import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Edit, Trash2, Image as ImageIcon, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function AdminGallery() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: galleryData, isLoading } = useQuery({
    queryKey: ["gallery-admin"],
    queryFn: async () => {
      const res = await api.get("/gallery?limit=100");
      return res.data.data.images;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await api.post("/gallery", formData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-admin"] });
      toast({ title: "Success", description: "Image uploaded successfully" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to upload image", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/gallery/${editingImage._id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-admin"] });
      toast({ title: "Success", description: "Image metadata updated" });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/gallery/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-admin"] });
      toast({ title: "Success", description: "Image deleted successfully" });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    if (editingImage) {
      const updateData = {
        title: fd.get("title"),
        description: fd.get("description"),
        category: fd.get("category"),
        altText: fd.get("altText"),
        featured: fd.get("featured") === "true",
        published: fd.get("published") === "true",
        displayOrder: Number(fd.get("displayOrder") || 0)
      };
      updateMutation.mutate(updateData);
    } else {
      uploadMutation.mutate(fd);
    }
  };

  const openCreateDialog = () => {
    setEditingImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsOpen(true);
  };

  const openEditDialog = (img: any) => {
    setEditingImage(img);
    setPreviewUrl(img.imageUrl);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Gallery CMS</h1>
          <p className="text-hotel-black/60">Manage images for the public website using Cloudinary</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-hotel-gold hover:bg-yellow-500 text-hotel-black flex items-center gap-2">
          <UploadCloud className="w-4 h-4" /> Upload Image
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-hotel-gold" /></div>
      ) : galleryData?.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-lg border">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium">No images found</h3>
          <p className="text-gray-500">Upload your first image to the gallery</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {galleryData?.map((img: any) => (
            <div key={img._id} className="bg-white rounded-lg border shadow-sm overflow-hidden group">
              <div className="aspect-video relative overflow-hidden bg-gray-100">
                <img src={img.imageUrl} alt={img.altText} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-2 right-2 flex gap-1">
                  {img.featured && <Badge className="bg-yellow-500 hover:bg-yellow-600 border-none">Featured</Badge>}
                  {!img.published && <Badge variant="secondary">Draft</Badge>}
                </div>
              </div>
              <div className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm truncate" title={img.title}>{img.title}</h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{img.category}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 truncate" title={img.altText}>{img.altText}</p>
                
                <div className="flex justify-between items-center border-t pt-2 mt-2">
                  <span className="text-xs text-gray-400">Order: {img.displayOrder}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Edit" className="h-7 w-7" onClick={() => openEditDialog(img)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" title="Delete" className="h-7 w-7 text-red-500" onClick={() => {
                      if (confirm("Delete this image permanently from Cloudinary?")) deleteMutation.mutate(img._id);
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingImage ? "Edit Image Details" : "Upload to Gallery"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left col: Image Preview & Upload */}
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 aspect-video overflow-hidden relative">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to select image</p>
                    </div>
                  )}
                  {!editingImage && (
                    <input 
                      type="file" 
                      name="image" 
                      accept="image/*" 
                      required={!editingImage}
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  )}
                </div>
                {editingImage && (
                  <p className="text-xs text-gray-500 italic text-center">To change the image, upload a new entry and delete this one.</p>
                )}
              </div>

              {/* Right col: Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input name="title" required defaultValue={editingImage?.title} placeholder="e.g. Presidential Suite View" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select name="category" className="w-full border rounded-md p-2 text-sm" defaultValue={editingImage?.category || "HOTEL"}>
                    <option value="HOTEL">Hotel</option>
                    <option value="ROOMS">Rooms</option>
                    <option value="DINING">Dining</option>
                    <option value="EXTERIOR">Exterior</option>
                    <option value="EXPERIENCE">Experience</option>
                    <option value="EVENTS">Events</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Alt Text (SEO)</label>
                  <Input name="altText" required defaultValue={editingImage?.altText} placeholder="Describe the image for SEO" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <Input name="description" defaultValue={editingImage?.description} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Display Order</label>
                    <Input name="displayOrder" type="number" defaultValue={editingImage?.displayOrder || 0} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Published</label>
                    <select name="published" className="w-full border rounded-md p-2 text-sm" defaultValue={editingImage?.published === false ? "false" : "true"}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="featured" value="true" defaultChecked={editingImage?.featured} className="rounded border-gray-300" />
                    <span className="text-sm font-medium">Mark as Featured Image</span>
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={uploadMutation.isPending || updateMutation.isPending}>
                {(uploadMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingImage ? "Save Changes" : "Upload Image"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
