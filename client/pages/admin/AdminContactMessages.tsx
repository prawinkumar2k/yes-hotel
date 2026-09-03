import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUSES = ["ALL", "NEW", "READ", "REPLIED", "ARCHIVED"];

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  READ: "bg-gray-50 text-gray-700 border-gray-200",
  REPLIED: "bg-green-50 text-green-700 border-green-200",
  ARCHIVED: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function AdminContactMessages() {
  const { toast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [viewingMessage, setViewingMessage] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["contact-messages", page, status],
    queryFn: async () => {
      const res = await api.get(`/admin/contact-messages?page=${page}&limit=15${status !== "ALL" ? `&status=${status}` : ""}`);
      return res.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await api.patch(`/admin/contact-messages/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast({ title: "Success", description: "Message status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/contact-messages/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast({ title: "Success", description: "Message deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete", variant: "destructive" });
    },
  });

  const handleView = (msg: any) => {
    setViewingMessage(msg);
    if (msg.status === "NEW") {
      updateStatusMutation.mutate({ id: msg._id, newStatus: "READ" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">Contact Messages</h1>
        <p className="text-hotel-black/60">View and respond to inquiries submitted through the website</p>
      </div>

      <div className="flex gap-2 mb-6">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">From</th>
              <th className="px-4 py-3 font-medium text-gray-500">Subject</th>
              <th className="px-4 py-3 font-medium text-gray-500">Received</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.messages?.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No messages found</td></tr>
            ) : (
              data?.messages?.map((msg: any) => (
                <tr key={msg._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-hotel-black">{msg.name}</div>
                    <div className="text-gray-500 text-xs">{msg.email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{msg.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(msg.createdAt), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_STYLES[msg.status]}>{msg.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleView(msg)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this message permanently?")) {
                            deleteMutation.mutate(msg._id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data?.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <Dialog open={!!viewingMessage} onOpenChange={(open) => !open && setViewingMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewingMessage?.subject}</DialogTitle></DialogHeader>
          {viewingMessage && (
            <div className="space-y-4">
              <div className="text-sm text-gray-500">
                <p><span className="font-medium text-hotel-black">{viewingMessage.name}</span> — {viewingMessage.email}</p>
                {viewingMessage.phone && <p>{viewingMessage.phone}</p>}
                <p>{format(new Date(viewingMessage.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{viewingMessage.message}</p>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter((s) => s !== "ALL").map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={viewingMessage.status === s ? "default" : "outline"}
                    onClick={() => {
                      updateStatusMutation.mutate({ id: viewingMessage._id, newStatus: s });
                      setViewingMessage({ ...viewingMessage, status: s });
                    }}
                  >
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
