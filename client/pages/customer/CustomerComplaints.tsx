import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Navbar from "@/components/hotel/Navbar";
import Footer from "@/components/hotel/Footer";
import { GoldButton, OutlineButton } from "@/components/hotel/HotelButtons";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, AlertCircle, CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";

async function apiFetch(url: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
}

export default function CustomerComplaints() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SERVICE_REQUEST");
  const [priority, setPriority] = useState("LOW");

  const { data, isLoading } = useQuery({
    queryKey: ["myComplaints"],
    queryFn: () => apiFetch("/api/complaints/my", user?.token),
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: (newComplaint: any) => apiFetch("/api/complaints/my", user?.token, "POST", newComplaint),
    onSuccess: (resData) => {
      if (resData.success) {
        toast({ title: "Submitted", description: "Your request has been received." });
        queryClient.invalidateQueries({ queryKey: ["myComplaints"] });
        setShowForm(false);
        setTitle("");
        setDescription("");
      } else {
        toast({ title: "Error", description: resData.message, variant: "destructive" });
      }
    },
  });

  const complaints = data?.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN": return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS": return "bg-amber-100 text-amber-800";
      case "RESOLVED": return "bg-green-100 text-green-800";
      case "CLOSED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl text-hotel-black mb-2">Service Requests & Support</h1>
            <p className="text-hotel-black/60">Need something? We are here to help.</p>
          </div>
          {!showForm && (
            <GoldButton onClick={() => setShowForm(true)} className="flex items-center gap-2">
              <Plus size={16} /> New Request
            </GoldButton>
          )}
        </div>

        {showForm ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-8 mb-8">
            <h3 className="font-serif text-2xl mb-6">Create New Request</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Category</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full border-b border-hotel-black/20 bg-transparent py-2 outline-none focus:border-hotel-gold transition-colors"
                  >
                    <option value="SERVICE_REQUEST">Service Request (e.g. Extra Towels, Pillows)</option>
                    <option value="MAINTENANCE">Maintenance Issue (e.g. AC, Plumbing)</option>
                    <option value="COMPLAINT">Service Complaint</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Urgency</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                    className="w-full border-b border-hotel-black/20 bg-transparent py-2 outline-none focus:border-hotel-gold transition-colors"
                  >
                    <option value="LOW">Low (Whenever possible)</option>
                    <option value="MEDIUM">Medium (Soon)</option>
                    <option value="HIGH">High (Important)</option>
                    <option value="URGENT">Urgent (Immediate)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Subject</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  placeholder="E.g. Extra towels needed"
                  className="w-full border-b border-hotel-black/20 bg-transparent py-2 outline-none focus:border-hotel-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Please provide details..."
                  rows={4}
                  className="w-full border border-hotel-black/20 bg-transparent p-3 outline-none focus:border-hotel-gold transition-colors resize-none"
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <OutlineButton onClick={() => setShowForm(false)} className="flex-1">Cancel</OutlineButton>
                <GoldButton 
                  onClick={() => submitMutation.mutate({ title, description, category, priority })}
                  disabled={submitMutation.isPending || !title || !description}
                  className="flex-1"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                </GoldButton>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-hotel-black/5" />)}
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-hotel-white border border-hotel-black/10 p-12 text-center">
            <MessageSquare size={40} className="mx-auto text-hotel-black/20 mb-4" />
            <p className="text-hotel-black/50">You have no active requests or complaints.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((c: any) => (
              <div key={c._id} className="bg-hotel-white border border-hotel-black/10 p-6 transition-all hover:border-hotel-gold group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-hotel-black/40 font-mono">{format(new Date(c.createdAt), "dd MMM yyyy, HH:mm")}</span>
                    </div>
                    <h3 className="font-serif text-xl text-hotel-black mb-1">{c.title}</h3>
                    <p className="text-sm text-hotel-black/70 mb-3">{c.description}</p>
                    
                    {c.resolutionNotes && (
                      <div className="bg-green-50 border border-green-100 p-4 mt-4">
                        <p className="text-xs font-semibold text-green-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <CheckCircle2 size={14} /> Resolution from Hotel
                        </p>
                        <p className="text-sm text-green-900">{c.resolutionNotes}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-xs uppercase tracking-widest text-hotel-black/40">Category</span>
                    <span className="block text-sm font-medium">{c.category.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
