import { useState } from "react";
import { Link, Routes, Route, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getStoredAuthToken } from "@/lib/authStorage";
import AdminMonthlyMIS from "./AdminMonthlyMIS";
import DaySummaryReport from "./reports/DaySummaryReport";
import CashSheetReport from "./reports/CashSheetReport";
const CATEGORIES = [
  { id: "daily-summary", name: "Daily Hotel Summary", path: "/admin/reports/daily-summary" },
  { id: "cash-sheet", name: "Cash Sheet", path: "/admin/reports/cash-sheet" },
  { id: "monthly-mis", name: "Monthly MIS Report", path: "/admin/reports/monthly-mis" },
];

export default function AdminReportsLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-white flex-shrink-0 flex flex-col shadow-sm z-10 h-48 md:h-auto overflow-y-auto">
        <div className="p-4 border-b bg-gray-50/50 sticky top-0 z-20">
          <h2 className="font-semibold text-gray-800 text-sm tracking-wider">HOTEL REPORTS</h2>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {CATEGORIES.map((category) => {
            const isActive = location.pathname.includes(category.id);
            return (
              <Link
                key={category.id}
                to={category.path}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-hotel-gold text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {category.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 w-full">
        <Routes>
          <Route path="/" element={<DaySummaryReport />} />
          <Route path="monthly-mis" element={<AdminMonthlyMIS />} />
          <Route path="daily-summary" element={<DaySummaryReport />} />
          <Route path="cash-sheet" element={<CashSheetReport />} />
          <Route path="*" element={<div className="p-4 text-gray-500">Select a report category from the sidebar.</div>} />
        </Routes>
      </div>
    </div>
  );
}
