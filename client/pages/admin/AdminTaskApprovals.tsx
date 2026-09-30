import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, RefreshCw, DollarSign,
  Lock, KeyRound, AlertTriangle, Building2, Landmark, ShieldAlert,
  ArrowRight, CreditCard, Sparkles, UserCheck, Wrench
} from "lucide-react";
import { format } from "date-fns";

interface ApprovalItem {
  _id: string;
  category: "FUND_TRANSFER" | "CONFIDENTIAL_OVERRIDE" | "MAINTENANCE";
  title: string;
  description: string;
  requestedBy: string;
  amount?: number;
  recipientAccount?: string;
  bankName?: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  confidentialLevel: "SUPER_ADMIN_ONLY" | "EXECUTIVE";
}



export default function AdminTaskApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"ALL" | "FUND_TRANSFER" | "CONFIDENTIAL_OVERRIDE" | "MAINTENANCE">("ALL");

  // Security Verification Modal State
  const [securityModal, setSecurityModal] = useState<{ open: boolean; item: ApprovalItem | null }>({ open: false, item: null });
  const [actionNote, setActionNote] = useState("");
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");

  // New approval creation modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    category: "MAINTENANCE" as string,
    title: "",
    description: "",
    amount: "",
    recipientAccount: "",
    bankName: "",
    priority: "MEDIUM" as string,
    confidentialLevel: "MANAGER" as string,
  });

  const createNewMutation = useMutation({
    mutationFn: async (body: typeof createForm) => {
      const res = await fetch("/api/task-approvals", {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          amount: body.amount ? Number(body.amount) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskApprovals"] });
      toast({ title: "✅ Approval Request Submitted", description: "The request has been logged and is pending review." });
      setCreateModal(false);
      setCreateForm({ category: "MAINTENANCE", title: "", description: "", amount: "", recipientAccount: "", bankName: "", priority: "MEDIUM", confidentialLevel: "MANAGER" });
    },
    onError: (err: any) => toast({ title: "Submission Failed", description: err.message, variant: "destructive" }),
  });

  const isSuperAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role || "");

  // Live API query — fetches real approvals from /api/task-approvals
  const { data: approvalsList = [], isLoading, refetch } = useQuery<ApprovalItem[]>({
    queryKey: ["taskApprovals", activeTab],
    queryFn: async () => {
      const params = activeTab !== "ALL" ? `?category=${activeTab}` : "";
      const res = await fetch(`/api/task-approvals${params}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data.map((a: any) => ({
        ...a,
        _id: a._id,
        requestedBy: a.requestedByName ||
          (a.requestedBy?.firstName
            ? `${a.requestedBy.firstName} ${a.requestedBy.lastName ?? ""}`.trim()
            : a.requestedBy?.email ?? "Unknown"),
        createdAt: a.createdAt,
      })) as ApprovalItem[];
    },
    enabled: !!user,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await fetch(`/api/task-approvals/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actionNote: note }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["taskApprovals"] });
      toast({ title: "✅ Request Authorized", description: "The approval has been granted and logged." });
      setSecurityModal({ open: false, item: null });
    },
    onError: (err: any) => toast({ title: "Approval Failed", description: err.message, variant: "destructive" }),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await fetch(`/api/task-approvals/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actionNote: note }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskApprovals"] });
      toast({ title: "🚫 Request Rejected", description: "The request has been rejected and logged in audit history." });
      setSecurityModal({ open: false, item: null });
    },
    onError: (err: any) => toast({ title: "Rejection Failed", description: err.message, variant: "destructive" }),
  });

  const handleOpenSecurityModal = (item: ApprovalItem, type: "APPROVE" | "REJECT") => {
    if (!isSuperAdmin && item.confidentialLevel === "SUPER_ADMIN_ONLY") {
      toast({
        title: "🔒 Super Admin Authorization Required",
        description: "Only the Super Admin can approve confidential fund transfers and executive overrides.",
        variant: "destructive",
      });
      return;
    }
    setActionNote("");
    setActionType(type);
    setSecurityModal({ open: true, item });
  };

  const handleConfirmAction = () => {
    if (!securityModal.item) return;
    const id = securityModal.item._id;
    if (actionType === "APPROVE") {
      approveMutation.mutate({ id, note: actionNote });
    } else {
      rejectMutation.mutate({ id, note: actionNote });
    }
  };

  const pendingList = approvalsList.filter((a) => a.status === "PENDING");
  const approvedList = approvalsList.filter((a) => a.status === "APPROVED");
  const fundTransfers = approvalsList.filter((a) => a.category === "FUND_TRANSFER" && a.status === "PENDING");
  const confidentialOverrides = approvalsList.filter((a) => a.category === "CONFIDENTIAL_OVERRIDE" && a.status === "PENDING");

  const displayedApprovals = activeTab === "ALL" ? approvalsList : approvalsList.filter((a) => a.category === activeTab);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Super Admin Security Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-gray-950 via-slate-900 to-amber-950 p-6 rounded-2xl border border-amber-500/30 text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
            <Lock size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-white">Super Admin & Fund Transfer Approvals</h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/40 uppercase tracking-widest">
                STRICTLY CONFIDENTIAL
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-1">
              Secured portal for authorizing bank fund transfers, high-value expense payouts, staff privilege elevations, and executive overrides
            </p>
          </div>
        </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-amber-400/80">Security Level</span>
              <p className="text-xs font-semibold text-white flex items-center gap-1">
                <ShieldAlert size={14} className="text-amber-400" /> Super Admin Authorized
              </p>
            </div>
            <button
              onClick={() => setCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition shadow-lg whitespace-nowrap flex-shrink-0"
            >
              <ArrowRight size={14} /> New Request
            </button>
          </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Pending Bank Transfers</span>
            <p className="text-3xl font-bold font-serif text-white mt-1">{fundTransfers.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Payout: ₹{fundTransfers.reduce((acc, i) => acc + (i.amount || 0), 0).toLocaleString("en-IN")}</p>
          </div>
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
            <Landmark size={24} />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-950/20 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Confidential Overrides</span>
            <p className="text-3xl font-bold font-serif text-white mt-1">{confidentialOverrides.length}</p>
            <p className="text-xs text-gray-400 mt-1">Privilege & discount approvals</p>
          </div>
          <div className="p-3 bg-purple-500/20 text-purple-300 rounded-xl">
            <KeyRound size={24} />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Authorized & Paid</span>
            <p className="text-3xl font-bold font-serif text-white mt-1">{approvedList.length}</p>
            <p className="text-xs text-emerald-300 mt-1">Signed off by Super Admin</p>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-gray-700 bg-[#121316] text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Approval Queue</span>
            <p className="text-3xl font-bold font-serif text-white mt-1">{pendingList.length}</p>
            <p className="text-xs text-gray-400 mt-1">Requires security sign-off</p>
          </div>
          <div className="p-3 bg-gray-800 text-gray-300 rounded-xl">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3 overflow-x-auto">
        {[
          { id: "ALL", label: `All Requests (${approvalsList.length})` },
          { id: "FUND_TRANSFER", label: `💰 Bank Fund Transfers (${fundTransfers.length})` },
          { id: "CONFIDENTIAL_OVERRIDE", label: `🔒 Confidential Work Overrides (${confidentialOverrides.length})` },
          { id: "MAINTENANCE", label: `🛠️ Critical Maintenance` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "bg-[#c9a227] text-black shadow-lg" : "bg-[#121316] text-gray-400 hover:text-white border border-[#262930]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {displayedApprovals.length === 0 ? (
          <div className="bg-[#121316] border border-[#262930] rounded-2xl p-12 text-center text-gray-400 space-y-2">
            <CheckCircle2 className="mx-auto text-emerald-400" size={32} />
            <p className="font-semibold text-white">No approval requests pending in this category</p>
            <p className="text-xs text-gray-500">All confidential transfers and work requests are cleared.</p>
          </div>
        ) : (
          displayedApprovals.map((item) => {
            const isPending = item.status === "PENDING";
            const isApproved = item.status === "APPROVED";

            return (
              <div
                key={item._id}
                className={`bg-[#121316] border rounded-2xl p-6 shadow-xl space-y-4 transition-all ${
                  isPending
                    ? item.category === "FUND_TRANSFER"
                      ? "border-amber-500/40 bg-gradient-to-r from-[#121316] to-amber-950/10"
                      : "border-purple-500/40 bg-gradient-to-r from-[#121316] to-purple-950/10"
                    : "border-gray-800 opacity-80"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info Column */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        item.category === "FUND_TRANSFER"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : item.category === "CONFIDENTIAL_OVERRIDE"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      }`}>
                        {item.category.replace(/_/g, " ")}
                      </span>

                      <span className="text-[10px] font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/40 uppercase">
                        SUPER ADMIN ONLY
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isPending ? "bg-amber-100 text-amber-900" : isApproved ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                      }`}>
                        {item.status}
                      </span>

                      <span className="text-xs text-gray-500 font-mono">ID: #{item._id}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white font-serif flex items-center gap-2">
                      {item.category === "FUND_TRANSFER" && <Landmark size={18} className="text-amber-400" />}
                      {item.category === "CONFIDENTIAL_OVERRIDE" && <Lock size={18} className="text-purple-400" />}
                      {item.title}
                    </h3>

                    <p className="text-xs text-gray-300 max-w-3xl">{item.description}</p>

                    {/* Bank / Transfer Metadata */}
                    {item.recipientAccount && (
                      <div className="bg-[#1a1d24] border border-[#262930] p-3 rounded-xl text-xs text-gray-300 flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-gray-500 block text-[10px] uppercase font-bold">Transfer Recipient Account</span>
                          <span className="font-semibold text-amber-300 font-mono">{item.recipientAccount}</span>
                        </div>
                        {item.bankName && (
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Bank Name</span>
                            <span className="font-semibold text-white">{item.bankName}</span>
                          </div>
                        )}
                        {item.amount && (
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Transfer Amount</span>
                            <span className="font-bold text-emerald-400 font-mono text-sm">₹{item.amount.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-1">
                      <span>Requested by: <strong className="text-gray-200">{item.requestedBy}</strong></span>
                      <span>•</span>
                      <span>Requested Date: {format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}</span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    {item.amount && !item.recipientAccount && (
                      <div className="text-right mr-3 hidden lg:block">
                        <span className="text-[10px] uppercase text-gray-400 font-bold block">Amount</span>
                        <span className="text-xl font-bold font-mono text-emerald-400">₹{item.amount.toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleOpenSecurityModal(item, "REJECT")}
                          className="px-4 py-2.5 bg-[#1a1d24] hover:bg-red-950/60 text-gray-300 hover:text-red-300 rounded-xl text-xs font-semibold border border-[#262930] hover:border-red-500/40 transition flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={15} /> Reject Request
                        </button>
                        <button
                          onClick={() => handleOpenSecurityModal(item, "APPROVE")}
                          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-1.5"
                        >
                          <Lock size={15} /> Authorize & Sign Off
                        </button>
                      </>
                    ) : (
                      <span className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                        isApproved ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-red-500/20 text-red-300 border border-red-500/40"
                      }`}>
                        {isApproved ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        {isApproved ? "Authorized by Super Admin" : "Declined by Super Admin"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SUPER ADMIN CONFIDENTIAL SECURITY AUTHORIZATION MODAL */}
      {securityModal.open && securityModal.item && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#262930] pb-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock size={22} />
                <h3 className="font-serif text-lg font-bold">Super Admin Security Verification</h3>
              </div>
              <button onClick={() => setSecurityModal({ open: false, item: null })} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-[#1a1d24] p-4 rounded-xl border border-[#262930] text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Target Request</span>
              <p className="font-bold text-white text-sm">{securityModal.item.title}</p>
              <p className="text-gray-300">{securityModal.item.description}</p>

              {securityModal.item.amount && (
                <div className="pt-2 border-t border-[#262930] flex justify-between items-center text-sm font-bold">
                  <span className="text-gray-400 text-xs">Transfer / Payout Value:</span>
                  <span className="text-emerald-400 font-mono">₹{securityModal.item.amount.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                Reason / Note (optional)
              </label>
              <textarea
                placeholder="Enter a note for the audit log (optional)..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
                className="w-full bg-[#1a1d24] border border-amber-500/40 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
              />
              <p className="text-[11px] text-gray-400 text-center">
                This action will be logged with your digital signature in the audit trail.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button
                onClick={() => setSecurityModal({ open: false, item: null })}
                className="px-4 py-2.5 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 disabled:opacity-60 ${
                  actionType === "APPROVE"
                    ? "bg-amber-500 hover:bg-amber-600 text-black font-bold"
                    : "bg-red-600 hover:bg-red-700 text-white font-bold"
                }`}
              >
                <ShieldCheck size={16} />
                {approveMutation.isPending || rejectMutation.isPending
                  ? "Processing..."
                  : actionType === "APPROVE" ? "Authorize & Sign Off" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Create Approval Modal ───────────────────────────────────────── */}
      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111318] border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ArrowRight size={20} />
                <h3 className="font-serif text-lg font-bold text-white">New Approval Request</h3>
              </div>
              <button onClick={() => setCreateModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Category *</label>
                <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400">
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="FUND_TRANSFER">Fund Transfer</option>
                  <option value="CONFIDENTIAL_OVERRIDE">Confidential Override</option>
                  <option value="DISCOUNT">Discount</option>
                  <option value="REFUND">Refund</option>
                  <option value="PURCHASE">Purchase</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Title *</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief title of the request" required
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400" />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Description *</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detailed justification for this request" rows={3} required
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input type="number" value={createForm.amount} onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Optional"
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400" />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Priority</label>
                <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              {createForm.category === "FUND_TRANSFER" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Recipient Account</label>
                    <input value={createForm.recipientAccount} onChange={e => setCreateForm(f => ({ ...f, recipientAccount: e.target.value }))}
                      placeholder="Bank account / UPI"
                      className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Bank Name</label>
                    <input value={createForm.bankName} onChange={e => setCreateForm(f => ({ ...f, bankName: e.target.value }))}
                      placeholder="e.g. HDFC Bank"
                      className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400" />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Approval Level Required</label>
                <select value={createForm.confidentialLevel} onChange={e => setCreateForm(f => ({ ...f, confidentialLevel: e.target.value }))}
                  className="w-full bg-[#1a1d24] border border-[#262930] text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-amber-400">
                  <option value="MANAGER">Manager Level</option>
                  <option value="EXECUTIVE">Executive Level</option>
                  <option value="SUPER_ADMIN_ONLY">Super Admin Only</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#262930] pt-4">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2.5 bg-[#1a1d24] text-gray-300 rounded-xl text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!createForm.title.trim() || !createForm.description.trim()) {
                    toast({ title: "Validation Error", description: "Title and description are required.", variant: "destructive" });
                    return;
                  }
                  createNewMutation.mutate(createForm);
                }}
                disabled={createNewMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-lg transition disabled:opacity-60 flex items-center gap-1.5"
              >
                <ArrowRight size={14} />
                {createNewMutation.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
