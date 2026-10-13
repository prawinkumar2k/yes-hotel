import { getStoredAuthToken } from "@/lib/authStorage";
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
  const [actorRole, setActorRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filterParams = () => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (resourceType) params.set("resourceType", resourceType);
    if (actorRole) params.set("actorRole", actorRole);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  };
  const exportCsv = async () => {
    const token = getStoredAuthToken();
    const res = await fetch(`/api/audit-logs/export?${filterParams().toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, action, resourceType, actorRole, dateFrom, dateTo],
    queryFn: async () => {
      const params = filterParams();
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await api.get(`/audit-logs?${params.toString()}`);
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-hotel-black">System Activity History & Log</h1>
        <p className="text-hotel-black/60">Detailed record of changes and staff actions across the system</p>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Action, or prefix with a dot (e.g. folio.)"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Input
          placeholder="Search by item type (e.g. Coupon)"
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Input placeholder="Role (e.g. CASHIER)" value={actorRole} onChange={(e) => { setActorRole(e.target.value.toUpperCase()); setPage(1); }} className="max-w-[160px]" />
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="max-w-[160px]" aria-label="From date" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="max-w-[160px]" aria-label="To date" />
        <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Staff Member / User</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action Taken</th>
              <th className="px-4 py-3 font-medium text-gray-500">Item Type & ID</th>
              <th className="px-4 py-3 font-medium text-gray-500">Details & Changes</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.logs?.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No activity records found</td></tr>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="outline">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.resourceType}
                    {log.resourceId && <div className="text-xs text-gray-400">{log.resourceId}</div>}
                  </td>
                  <td className="px-4 py-3 min-w-[250px]">
                    {log.metadata && typeof log.metadata === 'object' && (
                      <div className="flex flex-col gap-1 text-[11px] leading-tight">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key} className="bg-gray-50/80 rounded px-2 py-1.5 flex items-start border border-gray-100">
                            <span className="font-semibold text-gray-600 w-24 shrink-0 break-words capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-gray-800 break-all ml-2 flex-1 font-mono font-medium">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
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
