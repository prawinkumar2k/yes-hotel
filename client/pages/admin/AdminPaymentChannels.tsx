import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, AlertCircle, Ban, CheckCircle2 } from "lucide-react";

export default function AdminPaymentChannels() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "", code: "", type: "CASH", provider: "", settlementMode: "IMMEDIATE",
    commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, bankAccount: "", description: "", isActive: true
  });

  const { data: channels, isLoading } = useQuery({
    queryKey: ["payment-channels"],
    queryFn: async () => {
      const res = await api.get("/payment-channels");
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingChannel) {
        return await api.patch(`/payment-channels/${editingChannel._id}`, data);
      }
      return await api.post("/payment-channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-channels"] });
      setIsModalOpen(false);
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await api.patch(`/payment-channels/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-channels"] });
    }
  });

  const openEdit = (channel: any) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name, code: channel.code, type: channel.type, provider: channel.provider || "",
      settlementMode: channel.settlementMode, commissionPercentage: channel.commissionPercentage,
      fixedFee: channel.fixedFee, taxOnFee: channel.taxOnFee, bankAccount: channel.bankAccount || "",
      description: channel.description || "", isActive: channel.isActive
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-hotel-black">Payment Channels</h1>
          <p className="text-gray-500">Configure modes of payment, gateways, and settlements</p>
        </div>
        <Button onClick={() => { setEditingChannel(null); setFormData({ name: "", code: "", type: "CASH", provider: "", settlementMode: "IMMEDIATE", commissionPercentage: 0, fixedFee: 0, taxOnFee: 0, bankAccount: "", description: "", isActive: true }); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Channel
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Channel</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Provider</th>
              <th className="px-6 py-4 font-medium">Settlement</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? <tr><td colSpan={6} className="text-center p-8 text-gray-400">Loading...</td></tr> : 
              channels?.map((ch: any) => (
              <tr key={ch._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-semibold text-gray-900">{ch.name}</p>
                  <p className="text-xs text-gray-400">{ch.code}</p>
                </td>
                <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">{ch.type}</span></td>
                <td className="px-6 py-4 text-gray-600">{ch.provider || "N/A"}</td>
                <td className="px-6 py-4 text-gray-600">{ch.settlementMode}</td>
                <td className="px-6 py-4">
                  {ch.isActive ? (
                    <span className="inline-flex items-center text-green-700 bg-green-50 px-2 py-1 rounded text-xs"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>
                  ) : (
                    <span className="inline-flex items-center text-red-700 bg-red-50 px-2 py-1 rounded text-xs"><Ban className="w-3 h-3 mr-1"/> Disabled</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(ch)}><Edit className="w-4 h-4"/></Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleStatusMutation.mutate({ id: ch._id, isActive: !ch.isActive })}>
                    {ch.isActive ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editingChannel ? "Edit Channel" : "New Channel"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Razorpay Main" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <Input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. RAZORPAY_MAIN" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="Unified Payments Interface">Unified Payments Interface</option>
                  <option value="GATEWAY">GATEWAY</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="OTA_CREDIT">OTA CREDIT</option>
                  <option value="CORPORATE_CREDIT">CORPORATE CREDIT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider (Optional)</label>
                <Input value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} placeholder="e.g. HDFC, Razorpay" />
              </div>
              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-hotel-gold hover:bg-amber-600" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save Channel"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
