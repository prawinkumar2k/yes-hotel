import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { api } from "@/lib/api";

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const METHOD_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", RAZORPAY: "Razorpay", BANK_TRANSFER: "Bank transfer" };

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${tone || "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 break-words">{sub}</div>}
    </div>
  );
}

/** Sales for reception: cards (today, month, collections) and a 14-day chart. */
export function SalesOverview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["frontDeskSales"],
    queryFn: async () => (await api.get("/front-desk/sales-summary")).data.data,
    refetchInterval: 60_000,
  });
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  if (isError || !data) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Sales could not be loaded.</div>;

  const diff = data.today.total - data.yesterday.total;
  const collections: any[] = data.collections ?? [];
  const todayCollected = data.receivedToday ?? collections.reduce((t, c) => t + c.today, 0);

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-bold text-slate-900">Sales</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Today's sales" value={inr(data.today.total)} sub={`${diff >= 0 ? "▲" : "▼"} ${inr(Math.abs(diff))} vs yesterday`} tone={diff >= 0 ? "text-emerald-700" : "text-rose-700"} />
        <Card label="Room revenue today" value={inr(data.today.room)} sub={`Other sales ${inr(data.today.other)} · before GST`} />
        <Card label="Collected today" value={inr(todayCollected)} sub={collections.filter((c) => c.today > 0).map((c) => `${METHOD_LABEL[c.method] ?? c.method} ${inr(c.today)}`).join(" · ") || "No payments yet"} />
        <Card label="This month" value={inr(data.month.total)} sub={`Room ${inr(data.month.room)} · Other ${inr(data.month.other)} · received ${inr(data.receivedMonth)}`} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Last 14 days · sales before GST (same as the MIS sheet)</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "dd MMM")} fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(d) => format(new Date(d as string), "dd MMM yyyy")} />
              <Legend />
              <Bar dataKey="room" name="Room" stackId="s" fill="#c9a227" />
              <Bar dataKey="other" name="Other sales" stackId="s" fill="#0f172a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
