import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoredAuthToken } from "@/lib/authStorage";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, parseISO } from "date-fns";
import { Loader2, TrendingUp, Users, DollarSign, Building } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#c9a227", "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8"];

async function fetchReport(endpoint: string) {
  const token = getStoredAuthToken();
  const res = await fetch(`/api/reports/${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch");
  const json = await res.json();
  return json.data;
}

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: execSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["report", "executive-summary"],
    queryFn: () => fetchReport("executive-summary"),
  });

  const { data: revenueTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["report", "revenue-trend", timeRange],
    queryFn: () => fetchReport(`revenue-trend?days=${timeRange}`),
  });

  const { data: deptPL, isLoading: deptLoading } = useQuery({
    queryKey: ["report", "department-pl", timeRange],
    queryFn: () => fetchReport(`department-pl`), // Using overall data since we don't have date filtering in controller without explicit start/end
  });

  const { data: heatmap, isLoading: heatmapLoading } = useQuery({
    queryKey: ["report", "occupancy-heatmap"],
    queryFn: () => fetchReport("occupancy-heatmap"),
  });

  if (summaryLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-hotel-gold" size={32} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-serif text-hotel-black">Property Analytics</h2>
          <p className="text-hotel-black/60 text-sm">Comprehensive performance metrics and charts</p>
        </div>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:border-hotel-gold focus:ring-1 focus:ring-hotel-gold outline-none"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="In-House Guests" value={execSummary?.inHouseCount || 0} icon={<Users size={20} />} trend="Active Now" />
        <KPICard title="Occupancy" value={`${execSummary?.occupancyPct || 0}%`} icon={<Building size={20} />} trend={`${execSummary?.totalRooms || 0} Total Rooms`} />
        <KPICard title="Average Daily Rate" value={`₹${execSummary?.adr?.toLocaleString('en-IN') || 0}`} icon={<TrendingUp size={20} />} trend="Current ADR" />
        <KPICard title="MTD Revenue" value={`₹${execSummary?.monthlyRevenue?.toLocaleString('en-IN') || 0}`} icon={<DollarSign size={20} />} trend="Month to Date" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Revenue Trend (Last {timeRange} Days)</h3>
          {trendLoading ? (
             <div className="h-72 flex items-center justify-center bg-gray-50 animate-pulse rounded"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#c9a227" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(val) => `₹${(val/1000)}k`} 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, "Revenue"]}
                    labelFormatter={(label) => format(parseISO(label as string), 'MMM dd, yyyy')}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#c9a227" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Revenue by Department Pie Chart */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Revenue Breakdown</h3>
          {deptLoading ? (
            <div className="h-72 flex items-center justify-center bg-gray-50 animate-pulse rounded"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="h-72 w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptPL?.byLineType?.filter((d: any) => d.revenue > 0) || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="department"
                  >
                    {deptPL?.byLineType?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => `₹${val.toLocaleString('en-IN')}`} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-10%'}}>
                <span className="text-xs text-gray-500 uppercase">Total</span>
                <span className="text-sm font-bold text-gray-800">
                  ₹{deptPL?.byLineType?.reduce((acc: number, curr: any) => acc + curr.revenue, 0).toLocaleString('en-IN') || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Occupancy Heatmap Bar Chart */}
        <div className="lg:col-span-3 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Occupancy Trajectory (Last 30 Days)</h3>
          {heatmapLoading ? (
             <div className="h-64 flex items-center justify-center bg-gray-50 animate-pulse rounded"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmap?.heatmap || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(val) => `${val}%`} 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [
                       name === 'occupancyPct' ? `${value}%` : value, 
                       name === 'occupancyPct' ? 'Occupancy' : 'Occupied Rooms'
                    ]}
                    labelFormatter={(label) => format(parseISO(label as string), 'MMM dd, yyyy')}
                  />
                  <Bar dataKey="occupancyPct" fill="#1e293b" radius={[4, 4, 0, 0]} name="occupancyPct" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col group hover:border-hotel-gold transition-colors">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <div className="p-2 rounded bg-gray-50 text-gray-600 group-hover:bg-hotel-gold/10 group-hover:text-hotel-gold transition-colors">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-serif font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{trend}</p>
    </div>
  );
}
