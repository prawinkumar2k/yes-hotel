import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981']; // Gold, Blue, Purple, Green

export function ExecutiveCharts({ commandData }: { commandData: any }) {
  const pulse = commandData?.hotelPulse || { occupied: 0, available: 0, ooo: 0, occupancyPct: 0 };
  
  const occupancyData = [
    { name: 'Occupied', value: pulse.occupied, color: '#059669' }, // Emerald
    { name: 'Available', value: pulse.available, color: '#3B82F6' }, // Blue
    { name: 'Out of Order', value: pulse.ooo, color: '#EF4444' }, // Red
  ];

  const revenueData = commandData?.revenueTrend || [];
  const sourceData = commandData?.bookingSources || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      
      {/* Revenue Trend Line Chart */}
      <Card className="lg:col-span-2 shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-gray-700 uppercase tracking-wider">Revenue Trend (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`$${value}`, undefined]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" name="Actual Revenue" dataKey="revenue" stroke="#D97706" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Expected/Forecast" dataKey="expected" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Occupancy Donut Chart */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-gray-700 uppercase tracking-wider">Today's Occupancy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${value}`, 'Rooms']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-gray-900">{pulse.occupancyPct}%</span>
              <span className="text-xs text-gray-500 font-medium">Occupied</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Sources Bar Chart */}
      <Card className="lg:col-span-3 shadow-sm border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-gray-700 uppercase tracking-wider">Booking Sources (MTD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`${value}`, 'Bookings']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {sourceData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
