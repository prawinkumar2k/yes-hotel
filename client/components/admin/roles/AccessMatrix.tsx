import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Key, Check, X, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageResource {
  _id: string;
  key: string;
  name: string;
  module: string;
  propertyScoped: boolean;
  actions: string[];
}

interface Role {
  _id: string;
  name: string;
  description: string;
  isSystem: boolean;
}

interface RolePermission {
  _id: string;
  roleId: string;
  pageKey: string;
  actions: string[];
}

export function AccessMatrix() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Fetch Roles
  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await api.get("/permissions/roles");
      return res.data;
    },
  });

  // Fetch Pages
  const { data: pages, isLoading: pagesLoading } = useQuery<PageResource[]>({
    queryKey: ["pages"],
    queryFn: async () => {
      const res = await api.get("/permissions/pages");
      return res.data;
    },
  });

  // Fetch role permissions
  const { data: rolePermissions, isLoading: permsLoading } = useQuery<RolePermission[]>({
    queryKey: ["rolePermissions", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [];
      const res = await api.get(`/permissions/roles/${selectedRole}/permissions`);
      return res.data;
    },
    enabled: !!selectedRole,
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ pageKey, actions }: { pageKey: string; actions: string[] }) => {
      if (!selectedRole) throw new Error("No role selected");
      const res = await api.put(`/permissions/roles/${selectedRole}/permissions`, {
        pageKey,
        actions,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rolePermissions", selectedRole] });
      toast({ title: "Updated", description: "Role permissions saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
    },
  });

  const toggleAction = (pageKey: string, action: string, currentActions: string[]) => {
    const newActions = currentActions.includes(action)
      ? currentActions.filter((a) => a !== action)
      : [...currentActions, action];
    
    updatePermissionMutation.mutate({ pageKey, actions: newActions });
  };

  if (rolesLoading || pagesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-hotel-gold" />
      </div>
    );
  }

  // Group pages by module
  const groupedPages = pages?.reduce((acc, page) => {
    if (!acc[page.module]) acc[page.module] = [];
    acc[page.module].push(page);
    return acc;
  }, {} as Record<string, PageResource[]>) || {};

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* Sidebar: Roles List */}
      <div className="xl:col-span-1 border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-black font-serif flex items-center gap-2">
            <Shield className="w-4 h-4 text-hotel-gold" />
            System Roles
          </h3>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {roles?.map((role) => (
            <button
              key={role._id}
              onClick={() => setSelectedRole(role._id)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all border ${
                selectedRole === role._id 
                  ? "bg-hotel-gold/10 border-hotel-gold/50 shadow-sm" 
                  : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold ${selectedRole === role._id ? "text-hotel-gold" : "text-gray-900"}`}>
                  {role.name}
                </span>
                {role.name === "SUPER_ADMIN" && (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-gray-500 leading-snug">{role.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Permission Matrix */}
      <div className="xl:col-span-3 border border-gray-200 bg-white rounded-xl shadow-sm h-[700px] flex flex-col overflow-hidden">
        {!selectedRole ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50/50">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 border border-gray-200 shadow-inner">
              <Key className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Select a Role</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Choose a role from the sidebar to view and modify its access permissions across all system modules.
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const activeRole = roles?.find(r => r._id === selectedRole);
              const isSuperAdmin = activeRole?.name === "SUPER_ADMIN";

              return (
                <div className="flex flex-col h-full">
                  <div className="p-5 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{activeRole?.name}</h2>
                      {isSuperAdmin && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                          Full System Bypass
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      Configure granular action-level access for this role.
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                    {isSuperAdmin ? (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-start gap-4 shadow-sm">
                        <ShieldAlert className="w-8 h-8 text-red-500 shrink-0 mt-1" />
                        <div>
                          <h4 className="font-bold text-red-900 mb-1 text-lg">Super Admin privileges cannot be modified</h4>
                          <p className="text-sm text-red-700/80 leading-relaxed max-w-2xl">
                            This role inherently possesses full access to all system actions and bypasses all granular permission checks at the middleware level. It is hardcoded into the architecture to prevent accidental lockouts.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8 pb-10">
                        {Object.entries(groupedPages).map(([moduleGroup, modulePages]) => (
                          <div key={moduleGroup} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100/80 px-4 py-3 border-b border-gray-200">
                              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-600">
                                {moduleGroup} Module
                              </h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {modulePages.map((page) => {
                                const rolePerm = rolePermissions?.find((rp) => rp.pageKey === page.key);
                                const activeActions = rolePerm?.actions || [];
                                
                                return (
                                  <div key={page._id} className="p-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{page.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                          <code className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                            {page.key}
                                          </code>
                                          {page.propertyScoped && (
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                              Property Scoped
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {permsLoading ? (
                                      <div className="h-10 flex items-center gap-2 text-sm text-gray-400">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {(page.actions || []).map((action) => {
                                          const isEnabled = activeActions.includes(action);
                                          const isView = action === "VIEW";
                                          return (
                                            <button
                                              key={action}
                                              onClick={() => toggleAction(page.key, action, activeActions)}
                                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                                isEnabled 
                                                  ? isView ? "bg-green-50 border-green-200 text-green-700 shadow-sm hover:bg-green-100" : "bg-blue-50 border-blue-200 text-blue-700 shadow-sm hover:bg-blue-100"
                                                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                              }`}
                                            >
                                              {isEnabled ? (
                                                <Check className="w-3 h-3" />
                                              ) : (
                                                <div className="w-3 h-3 border border-gray-300 rounded-full bg-gray-50" />
                                              )}
                                              {action}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
