import React from "react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/PermissionContext";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { getStoredAuthToken } from "@/lib/authStorage";

import { CommandCenterHeader } from "@/components/admin/command-center/CommandCenterHeader";
import { HotelPulse } from "@/components/admin/command-center/HotelPulse";
import { ExceptionCenter } from "@/components/admin/command-center/ExceptionCenter";
import { FrontOfficeCommand } from "@/components/admin/command-center/FrontOfficeCommand";
import { RevenueCommand } from "@/components/admin/command-center/RevenueCommand";
import { RoomControl } from "@/components/admin/command-center/RoomControl";
import { HousekeepingAndMaintenanceControl } from "@/components/admin/command-center/HousekeepingMaintenanceControl";
import { GuestIntelligence } from "@/components/admin/command-center/GuestIntelligence";
import { FinanceCommand } from "@/components/admin/command-center/FinanceCommand";
import { NightAuditCommand } from "@/components/admin/command-center/NightAuditCommand";
import { ForecastCommand } from "@/components/admin/command-center/ForecastCommand";
import { InventoryCommand } from "@/components/admin/command-center/InventoryCommand";
import { CorporateCommand } from "@/components/admin/command-center/CorporateCommand";
import { BanquetCommand } from "@/components/admin/command-center/BanquetCommand";
import { AdvanceCommand } from "@/components/admin/command-center/AdvanceCommand";
import { ProcurementCommand } from "@/components/admin/command-center/ProcurementCommand";
import { ApprovalCommand } from "@/components/admin/command-center/ApprovalCommand";
import { RecentActivityCommand } from "@/components/admin/command-center/RecentActivityCommand";
import { FrontDeskDashboard } from "@/components/admin/command-center/roles/FrontDeskDashboard";
import { HousekeepingDashboard } from "@/components/admin/command-center/roles/HousekeepingDashboard";
import { MaintenanceDashboard } from "@/components/admin/command-center/roles/MaintenanceDashboard";
import { ReservationsDashboard } from "@/components/admin/command-center/roles/ReservationsDashboard";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "FINANCE", "RESTAURANT", "EVENTS", "INVENTORY", "PROCUREMENT", "HOUSEKEEPING", "MAINTENANCE"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { hasPageAccess } = usePermissions();

  const isExecutive = hasPageAccess("DASHBOARD.ADMIN");
  const isFrontDesk = hasPageAccess("DASHBOARD.FRONT_DESK");
  const isHousekeeping = hasPageAccess("DASHBOARD.HOUSEKEEPING");
  const isMaintenance = hasPageAccess("DASHBOARD.MAINTENANCE");

  const hasAnyDashboardAccess = isExecutive || isFrontDesk || isHousekeeping || isMaintenance;

  const getHeaders = () => {
    const token = getStoredAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: commandData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["commandCenter"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/command-center", { headers: getHeaders() });
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: hasAnyDashboardAccess,
    refetchInterval: 30000,
  });

  if (!hasAnyDashboardAccess) {
    return (
      <AdminLayout title="Dashboard">
        <div className="p-10 flex justify-center text-zinc-500 font-mono text-xs">
          Operations command center requires STAFF clearance.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Executive Command Center">
      <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
        <CommandCenterHeader user={user} onRefresh={refetch} isRefreshing={isRefetching || isLoading} />
        
        {isLoading && !commandData ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 font-mono text-xs animate-pulse">
            Booting Operational Command Matrix...
          </div>
        ) : isExecutive ? (
          <>
            <HotelPulse 
              pulseData={commandData?.hotelPulse} 
              revenue={commandData?.revenue}
              housekeeping={commandData?.housekeeping}
              arrivals={commandData?.arrivals}
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <FrontOfficeCommand 
                  inHouse={commandData?.inHouse} 
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <RevenueCommand revenue={commandData?.revenue} />
                  <AdvanceCommand advances={commandData?.advances} />
                </div>
                
                <HousekeepingAndMaintenanceControl 
                  housekeeping={commandData?.housekeeping}
                  maintenance={commandData?.maintenance}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  <RoomControl pulseData={commandData?.hotelPulse} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2 h-full">
                    <ForecastCommand forecast={commandData?.forecast} />
                  </div>
                  <div className="lg:col-span-1 h-full">
                    <FinanceCommand finance={commandData?.revenue} />
                  </div>
                  <div className="lg:col-span-1 h-full">
                    <ApprovalCommand approvals={commandData?.approvals} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-1 h-full">
                    <InventoryCommand inventory={commandData?.inventory} />
                  </div>
                  <div className="lg:col-span-1 h-full">
                    <ProcurementCommand procurement={commandData?.procurement} />
                  </div>
                  <div className="lg:col-span-1 h-full">
                    <CorporateCommand corporate={commandData?.corporate} />
                  </div>
                  <div className="lg:col-span-1 h-full">
                    <BanquetCommand banquets={commandData?.banquets} />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1 space-y-6 h-full flex flex-col">
                <div className="flex-none">
                  <ExceptionCenter actionQueue={commandData?.actionQueue || []} />
                </div>
                <div className="flex-1">
                  <RecentActivityCommand activities={commandData?.recentActivity || []} />
                </div>
              </div>
            </div>
          </>
        ) : isFrontDesk ? (
          <FrontDeskDashboard commandData={commandData} />
        ) : isHousekeeping ? (
          <HousekeepingDashboard commandData={commandData} />
        ) : isMaintenance ? (
          <MaintenanceDashboard commandData={commandData} />
        ) : (
          <div className="p-10 flex justify-center text-zinc-500 font-mono text-xs">
             No specific dashboard assigned.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
