import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { format } from "date-fns";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Search,
  MessageSquare,
  CheckCircle2
} from "lucide-react";

export default function AdminComplaints() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const queryClient = useQueryClient();

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["complaints", statusFilter],
    queryFn: async () => {
      const qs = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await api.get(`/complaints${qs}`);
      return res.data;
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/complaints/${id}/status`, { status: "RESOLVED", resolutionNotes: "Resolved by Admin" });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
    }
  });

  const filteredComplaints = complaints.filter((c: any) => 
    c.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT": return "bg-red-100 text-red-800";
      case "HIGH": return "bg-orange-100 text-orange-800";
      case "MEDIUM": return "bg-yellow-100 text-yellow-800";
      default: return "bg-green-100 text-green-800";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Complaints & Service Recovery</h1>
          <p className="text-muted-foreground">Manage guest issues and track SLA breaches.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search issues or departments..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background max-w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p>Loading complaints...</p>
        ) : filteredComplaints.length === 0 ? (
          <p className="text-muted-foreground">No complaints found.</p>
        ) : (
          filteredComplaints.map((c: any) => (
            <Card key={c._id} className={new Date(c.slaBreachTime) < new Date() && c.status !== "RESOLVED" ? "border-red-500" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline">{c.department}</Badge>
                  <Badge className={getPriorityColor(c.priority)}>{c.priority}</Badge>
                </div>
                <CardTitle className="text-lg mt-2">{c.issue}</CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  SLA Breach: {format(new Date(c.slaBreachTime), "PPp")}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={c.status === "RESOLVED" ? "secondary" : "default"}>{c.status}</Badge>
                  </div>
                  {c.roomNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room:</span>
                      <span className="font-medium">{c.roomNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest:</span>
                    <span className="font-medium">{c.guestId?.fullName || "Unknown"}</span>
                  </div>
                  
                  {c.status !== "RESOLVED" && c.status !== "CLOSED" && (
                    <Button 
                      className="w-full mt-4" 
                      variant="outline"
                      onClick={() => resolveMutation.mutate(c._id)}
                      disabled={resolveMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
