import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Edit, Shield, UserCog, UserCheck, UserMinus, Search, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { AccessMatrix } from "@/components/admin/roles/AccessMatrix";
import { usePermissions } from "@/context/PermissionContext";

export default function AdminStaff() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("STAFF", "CREATE");
  const canEdit = hasPermission("STAFF", "EDIT");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetStaff, setResetStaff] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", page, searchTerm, roleFilter, deptFilter],
    queryFn: async () => {
      let url = `/staff?page=${page}&limit=10`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (roleFilter) url += `&role=${roleFilter}`;
      if (deptFilter) url += `&department=${deptFilter}`;
      const res = await api.get(url);
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingStaff) {
        const res = await api.patch(`/staff/${editingStaff._id}`, data);
        return res.data;
      } else {
        const res = await api.post("/staff", data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({ title: "Success", description: "Staff member saved successfully" });
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to save", variant: "destructive" });
    }
  });

  const resetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/staff/${resetStaff._id}/reset-password`, data);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Password reset successfully" });
      setIsResetOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to reset password", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      role: fd.get("role") as string,
      department: fd.get("department") as string,
      employmentStatus: fd.get("employmentStatus") as string,
      phone: fd.get("phone") as string,
      emergencyContactName: fd.get("emergencyContactName") as string,
      emergencyContactPhone: fd.get("emergencyContactPhone") as string,
      isActive: fd.get("isActive") === "true",
    };

    if (!editingStaff) {
      data.email = fd.get("email") as string;
      data.password = fd.get("password") as string;
    }

    saveMutation.mutate(data);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN": return <Badge variant="destructive" className="flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</Badge>;
      case "MANAGER": return <Badge variant="outline" className="border-hotel-gold text-hotel-gold bg-yellow-50 flex items-center gap-1"><UserCog className="w-3 h-3" /> Manager</Badge>;
      default: return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-white font-bold">Staff Members & Access Permissions</h1>
          <p className="text-gray-200 text-sm font-medium">Manage employee accounts, job roles, and staff permissions</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditingStaff(null); setIsFormOpen(true); }} className="bg-hotel-gold hover:bg-yellow-500 text-black font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Staff Member
          </Button>
        )}
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-6 bg-white border border-gray-200">
          <TabsTrigger value="directory" className="data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Staff Directory</TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-hotel-gold data-[state=active]:text-black">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-0">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-700 h-4 w-4" />
          <Input 
            placeholder="Search by name, email..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10 text-black font-medium border-gray-400"
          />
        </div>
        <div className="flex gap-2">
          <select className="border border-gray-400 rounded-md px-3 py-2 text-sm text-black font-bold bg-white" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="HOUSEKEEPING">Housekeeping</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
          <select className="border border-gray-400 rounded-md px-3 py-2 text-sm text-black font-bold bg-white" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
            <option value="">All Departments</option>
            <option value="MANAGEMENT">Management</option>
            <option value="FRONT_DESK">Front Desk</option>
            <option value="HOUSEKEEPING">Housekeeping</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="F_AND_B">F&B</option>
            <option value="HR">HR</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-4 py-3 font-bold text-black uppercase text-xs">Employee</th>
              <th className="px-4 py-3 font-bold text-black uppercase text-xs">Role & Dept</th>
              <th className="px-4 py-3 font-bold text-black uppercase text-xs">Status</th>
              <th className="px-4 py-3 font-bold text-black uppercase text-xs">Last Login</th>
              <th className="px-4 py-3 font-bold text-black uppercase text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-hotel-gold" /></td></tr>
            ) : data?.staff?.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-800 font-bold">No staff members found</td></tr>
            ) : (
              data?.staff?.map((s: any) => (
                <tr key={s._id} className="hover:bg-amber-50/40 text-black">
                  <td className="px-4 py-3">
                    <div className="font-bold flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-black text-sm">{s.firstName} {s.lastName}</div>
                        <div className="text-xs text-gray-700 font-medium">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      {getRoleBadge(s.role)}
                      <span className="text-xs text-gray-800 font-bold">{s.profile?.department || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.isActive ? (
                      <Badge variant="outline" className="bg-green-100 text-green-900 border-green-300 font-bold"><UserCheck className="w-3 h-3 mr-1" /> Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-200 text-black font-bold"><UserMinus className="w-3 h-3 mr-1" /> Inactive</Badge>
                    )}
                    <div className="text-xs text-gray-700 font-medium mt-1">{s.profile?.employmentStatus || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-800 font-semibold">
                    {s.lastLogin ? format(new Date(s.lastLogin), 'MMM d, yyyy HH:mm') : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <>
                          <Button variant="outline" size="icon" title="Reset Password" onClick={() => { setResetStaff(s); setIsResetOpen(true); }} className="border-gray-300 hover:bg-gray-100 text-black"><Key className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" title="Edit" onClick={() => { setEditingStaff(s); setIsFormOpen(true); }} className="border-gray-300 hover:bg-gray-100 text-black"><Edit className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {data?.totalPages > 1 && (
          <div className="p-4 border-t border-gray-300 flex justify-between items-center bg-gray-50">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="font-bold border-gray-400 text-black">Previous</Button>
            <span className="text-sm font-bold text-black">Page {page} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)} className="font-bold border-gray-400 text-black">Next</Button>
          </div>
        )}
      </div>
      </TabsContent>
      <TabsContent value="permissions" className="mt-0">
        <AccessMatrix />
      </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">Account Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input name="firstName" required defaultValue={editingStaff?.firstName} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input name="lastName" required defaultValue={editingStaff?.lastName} />
              </div>
            </div>
            {!editingStaff && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Initial Password</label>
                  <Input name="password" type="password" required minLength={6} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select name="role" className="w-full border rounded-md p-2 text-sm" defaultValue={editingStaff?.role || "RECEPTIONIST"}>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="HOUSEKEEPING">Housekeeping</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Account Status</label>
                <select name="isActive" className="w-full border rounded-md p-2 text-sm" defaultValue={editingStaff?.isActive === false ? "false" : "true"}>
                  <option value="true">Active (Can Login)</option>
                  <option value="false">Inactive (Suspended)</option>
                </select>
              </div>
            </div>

            <h4 className="font-semibold text-gray-900 border-b pb-2 mt-6">HR Profile</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <select name="department" className="w-full border rounded-md p-2 text-sm" defaultValue={editingStaff?.profile?.department || "FRONT_DESK"}>
                  <option value="MANAGEMENT">Management</option>
                  <option value="FRONT_DESK">Front Desk</option>
                  <option value="HOUSEKEEPING">Housekeeping</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="F_AND_B">Food & Beverage</option>
                  <option value="HR">Human Resources</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Employment Status</label>
                <select name="employmentStatus" className="w-full border rounded-md p-2 text-sm" defaultValue={editingStaff?.profile?.employmentStatus || "FULL_TIME"}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input name="phone" defaultValue={editingStaff?.phone} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Emergency Contact Name</label>
                <Input name="emergencyContactName" defaultValue={editingStaff?.profile?.emergencyContactName} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Emergency Contact Phone</label>
                <Input name="emergencyContactPhone" defaultValue={editingStaff?.profile?.emergencyContactPhone} />
              </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Staff Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            resetMutation.mutate({ newPassword: fd.get("newPassword") as string });
          }} className="space-y-4">
            <p className="text-sm text-gray-500">Resetting password for {resetStaff?.firstName} {resetStaff?.lastName} ({resetStaff?.email})</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input name="newPassword" type="text" required minLength={6} placeholder="Enter new password" />
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={resetMutation.isPending}>
                {resetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Reset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

