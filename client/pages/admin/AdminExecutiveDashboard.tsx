import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  TrendingUp, BedDouble, DollarSign, AlertCircle,
  Users, BarChart2, Activity, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar, Cell
} from "recharts";

const KPI = ({
  title, value, sub, icon: Icon, trend, color
}: {
  title: string; value: string; sub?: string;
  icon: any; trend?: "up" | "down" | "neutral"; color: string;
}) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-gray-400"}`}>
          {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
          <span>{trend === "up" ? "Performing well" : trend === "down" ? "Needs attention" : "Stable"}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const DEPT_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe", "#f5f3ff"];

export default function AdminExecutiveDashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["executive-summary"],
    queryFn: async () => {
      const res = await api.get("/reports/executive-summary");
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["revenue-trend"],
    queryFn: async () => {
      const res = await api.get("/reports/revenue-trend?days=30");
      return res.data.data;
    },
  });

  const { data: deptData } = useQuery({
    queryKey: ["department-pl"],
    queryFn: async () => {
      const res = await api.get("/reports/department-pl");
      return res.data.data;
    },
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["occupancy-heatmap"],
    queryFn: async () => {
      const res = await api.get("/reports/occupancy-heatmap");
      return res.data.data;
    },
  });

  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n?.toLocaleString("en-IN") ?? 0}`;

  return (
    <div className="space-y-8 p-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Command Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live KPI snapshot — refreshes every 60 seconds
        </p>
      </div>

      {/* KPI Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI title="Occupancy" value={`${summary?.occupancyPct ?? 0}%`}
            sub={`${summary?.inHouseCount ?? 0} / ${summary?.totalRooms ?? 0} rooms`}
            icon={BedDouble} color="bg-indigo-500"
            trend={summary?.occupancyPct >= 70 ? "up" : "down"} />
          <KPI title="ADR" value={fmt(summary?.adr ?? 0)}
            sub="Avg Daily Rate (In-house)"
            icon={TrendingUp} color="bg-emerald-500" trend="neutral" />
          <KPI title="RevPAR" value={fmt(summary?.revpar ?? 0)}
            sub="Revenue Per Available Room"
            icon={BarChart2} color="bg-violet-500" trend="neutral" />
          <KPI title="MTD Revenue" value={fmt(summary?.monthlyRevenue ?? 0)}
            sub="Month-to-date folio charges"
            icon={DollarSign} color="bg-amber-500"
            trend={summary?.monthlyRevenue > 0 ? "up" : "neutral"} />
          <KPI title="Bookings Today" value={`${summary?.totalBookingsToday ?? 0}`}
            sub="New reservations today"
            icon={Users} color="bg-blue-500" trend="neutral" />
          <KPI title="Payments Today" value={fmt(summary?.paymentsToday ?? 0)}
            sub={`${summary?.paymentsTodayCount ?? 0} transactions`}
            icon={Activity} color="bg-teal-500" trend="up" />
          <KPI title="Open Complaints" value={`${summary?.openComplaints ?? 0}`}
            sub="OPEN + IN_PROGRESS"
            icon={AlertCircle} color={summary?.openComplaints > 0 ? "bg-red-500" : "bg-green-500"}
            trend={summary?.openComplaints > 0 ? "down" : "up"} />
          <KPI title="Total Rooms" value={`${summary?.totalRooms ?? 0}`}
            sub="Property inventory"
            icon={BedDouble} color="bg-slate-500" trend="neutral" />
        </div>
      )}

      {/* Revenue Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Trend — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`} />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                  labelFormatter={(l) => `Date: ${l}`} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1"
                  strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department P&L Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Department Revenue Mix</CardTitle>
          </CardHeader>
          <CardContent>
            {deptData?.byLineType?.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptData.byLineType.slice(0, 7)} layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 9 }} width={90} />
                  <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {deptData.byLineType.slice(0, 7).map((_: any, index: number) => (
                      <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No department data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">30-Day Occupancy Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {heatmapData?.heatmap?.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {heatmapData.heatmap.map((day: any) => {
                const pct = day.occupancyPct;
                const bg =
                  pct >= 90 ? "bg-indigo-600" :
                  pct >= 70 ? "bg-indigo-400" :
                  pct >= 50 ? "bg-indigo-300" :
                  pct >= 30 ? "bg-indigo-200" :
                  pct > 0   ? "bg-indigo-100" : "bg-gray-100";
                return (
                  <div key={day.date} title={`${day.date}: ${pct}% (${day.occupied} rooms)`}
                    className={`w-8 h-8 rounded text-[9px] font-bold flex items-center justify-center text-white cursor-default ${bg}`}>
                    {pct > 0 ? `${pct}` : ""}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No occupancy data available yet.</p>
          )}
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> 0%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> 30–50%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-400 inline-block" /> 70–89%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> 90%+</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
