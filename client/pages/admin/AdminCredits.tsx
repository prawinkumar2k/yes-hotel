import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const inr = (n?: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Credit (kadan): what guests left unpaid and still owe. Collect when they pay. */
export default function AdminCredits() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"OPEN" | "SETTLED" | "ALL">("OPEN");
  const [collect, setCollect] = useState<any | null>(null);
  const [form, setForm] = useState({ amount: "", method: "CASH", reference: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["credits", status],
    queryFn: async () => (await api.get(`/credits?status=${status}`)).data.data as { entries: any[]; outstanding: number },
  });

  const submit = useMutation({
    mutationFn: async () => (await api.post(`/credits/${collect._id}/collect`, { amount: Number(form.amount), method: form.method, reference: form.reference || undefined })).data,
    onSuccess: (res) => {
      toast({ title: "Collected", description: res.message });
      setCollect(null);
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (e: any) => toast({ title: "Could not collect", description: e?.response?.data?.message || e.message, variant: "destructive" }),
  });

  const due = (e: any) => Math.max(0, e.amount - e.collectedTotal);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-900">Credit (Kadan)</h2>
          <p className="text-xs text-gray-500">Amounts guests left unpaid. Collect them here when the guest pays; the money counts in the day's collection on that day.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase text-gray-500">Outstanding</div>
          <div className="text-2xl font-bold text-red-600">{inr(data?.outstanding)}</div>
        </div>
      </div>
      <div className="flex gap-2">
        {(["OPEN", "SETTLED", "ALL"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${status === s ? "bg-black text-[#e5c76b] border-black" : "bg-white text-gray-600 border-gray-300"}`}>{s === "OPEN" ? "Pending" : s === "SETTLED" ? "Settled" : "All"}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-hotel-gold" size={28} /></div>
      ) : error || !data ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Could not load the credits.</div>
      ) : data.entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 bg-white border border-gray-200 rounded-lg">No credit entries.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Guest</th><th className="text-left p-2">Room</th><th className="text-left p-2">Booking</th><th className="text-right p-2">Credit</th><th className="text-right p-2">Collected</th><th className="text-right p-2">Due</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {data.entries.map((e: any) => (
                <tr key={e._id} className="border-t border-gray-100">
                  <td className="p-2 whitespace-nowrap">{format(new Date(e.createdAt), "dd-MM-yyyy")}</td>
                  <td className="p-2"><div className="font-semibold">{e.guestName}</div><div className="text-xs text-gray-500">{e.phone}</div></td>
                  <td className="p-2">{e.roomNumber || "–"}</td>
                  <td className="p-2 font-mono text-xs">{e.booking?.bookingReference || "–"}</td>
                  <td className="p-2 text-right tabular-nums">{inr(e.amount)}</td>
                  <td className="p-2 text-right tabular-nums">{inr(e.collectedTotal)}</td>
                  <td className="p-2 text-right tabular-nums font-bold">{inr(due(e))}</td>
                  <td className="p-2 text-right">
                    {e.status === "OPEN" ? (
                      <button type="button" onClick={() => { setCollect(e); setForm({ amount: String(due(e)), method: "CASH", reference: "" }); }} className="px-3 py-1.5 bg-black text-[#e5c76b] rounded-lg text-xs font-bold">Collect</button>
                    ) : <span className="text-xs font-bold text-green-700">Settled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {collect && (
        <div role="dialog" aria-modal="true" aria-label="Collect credit" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setCollect(null)}>
          <form className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Collect from {collect.guestName}</h3><button type="button" onClick={() => setCollect(null)} aria-label="Close"><X size={18} /></button></div>
            <p className="text-sm text-gray-600">Due <b>{inr(due(collect))}</b></p>
            <label className="block text-xs font-bold text-gray-600">Amount (₹)
              <input type="number" min="0.01" step="0.01" max={due(collect)} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="block text-xs font-bold text-gray-600">Method
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option>
              </select>
            </label>
            {form.method !== "CASH" && (
              <label className="block text-xs font-bold text-gray-600">{form.method === "CARD" ? "Approval code" : "UTR / reference"} *
                <input required value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
            )}
            <button type="submit" disabled={submit.isPending} className="w-full py-2.5 rounded-xl bg-black text-[#e5c76b] font-bold text-sm disabled:opacity-50">{submit.isPending ? "Recording…" : `Collect ${inr(Number(form.amount) || 0)}`}</button>
          </form>
        </div>
      )}
    </div>
  );
}
