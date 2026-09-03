import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, action, resourceType],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (action) params.set("action", action);
      if (resourceType) params.set("resourceType", resourceType);
      const res = await api.get(`/audit-logs?${params.toString()}`);
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">Audit Logs</h1>
        <p className="text-hotel-black/60">Record of sensitive administrative actions</p>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Filter by action (e.g. coupon.created)"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter by resource type (e.g. Coupon)"
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Actor</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="px-4 py-3 font-medium text-gray-500">Resource</th>
              <th className="px-4 py-3 font-medium text-gray-500">Details</th>
              <th className="px-4 py-3 font-medium text-gray-500">When</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.logs?.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No audit records found</td></tr>
            ) : (
              data?.logs?.map((log: any) => (
                <tr key={log._id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-hotel-black">
                      {log.actorType === "USER"
                        ? `${log.actorId?.firstName ?? ""} ${log.actorId?.lastName ?? ""}`.trim() || "Unknown user"
                        : log.actorType === "GUEST"
                          ? "Guest checkout"
                          : "System"}
                    </div>
                    <div className="text-gray-500 text-xs">{log.actorRole}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.resourceType}
                    {log.resourceId && <div className="text-xs text-gray-400">{log.resourceId}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {log.metadata && (
                      <pre className="text-xs text-gray-500 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
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
    </div>
  );
}
