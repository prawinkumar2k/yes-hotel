import { useState, useEffect } from "react";
import { Landmark, RefreshCw, CheckCircle2, DollarSign, PieChart, TrendingUp, Calendar, FileSpreadsheet, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccountingData {
  summary: {
    grossSales: number;
    totalTax: number;
    cgstPayable: number;
    sgstPayable: number;
    igstPayable: number;
    totalDiscounts: number;
    cashCollected: number;
    cardCollected: number;
    upiCollected: number;
    razorpayCollected: number;
    netCollections: number;
  };
  glAccounts: Array<{
    accountCode: string;
    accountName: string;
    category: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
    debit: number;
    credit: number;
  }>;
  balanceSheetCheck: {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
}

interface AgingAccount {
  companyId: string;
  companyName: string;
  companyCode: string;
  gstNumber: string;
  creditLimit: number;
  totalOutstanding: number;
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90Plus: number;
  };
  utilizationPct: number;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AdminAccounting() {
  const { toast } = useToast();
  const [data, setData] = useState<AccountingData | null>(null);
  const [agingData, setAgingData] = useState<AgingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"gl" | "tax" | "aging">("gl");

  const fetchAccounting = async () => {
    setLoading(true);
    try {
      const [resSummary, resAging] = await Promise.all([
        fetch("/api/accounting/summary", { headers: getAuthHeaders() }),
        fetch("/api/accounting/aging", { headers: getAuthHeaders() }),
      ]);

      const dataSummary = await resSummary.json();
      const dataAging = await resAging.json();

      if (dataSummary.success) setData(dataSummary.data);
      if (dataAging.success) setAgingData(dataAging.data.accounts);
    } catch {
      toast({ title: "Error", description: "Failed to load accounting data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounting(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="text-emerald-600" size={24} />
            General Ledger & Accounting Foundation
          </h2>
          <p className="text-sm text-gray-500 mt-1">Financial GL mapping, GST tax ledgers, and B2B corporate credit aging</p>
        </div>
        <button onClick={fetchAccounting} className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold">Gross Operational Sales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{data.summary.grossSales.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold">GST Output Tax Payable</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">₹{data.summary.totalTax.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold">Net Collections Collected</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">₹{data.summary.netCollections.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-semibold">GL Balance Check</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-lg font-bold ${data.balanceSheetCheck.isBalanced ? "text-emerald-600" : "text-red-600"}`}>
                {data.balanceSheetCheck.isBalanced ? "Balanced (0 Diff)" : "Imbalance Detected"}
              </span>
              <CheckCircle2 className="text-emerald-500" size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab("gl")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "gl" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          General Ledger Chart of Accounts
        </button>
        <button
          onClick={() => setActiveTab("tax")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "tax" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          GST Tax Ledger Breakdown
        </button>
        <button
          onClick={() => setActiveTab("aging")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === "aging" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          B2B Corporate Credit Aging ({agingData.length})
        </button>
      </div>

      {/* GL View */}
      {activeTab === "gl" && data && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">GL Code</th>
                <th className="px-4 py-3">Account Name</th>
                <th className="px-4 py-3">Classification</th>
                <th className="px-4 py-3 text-right">Debit (Dr)</th>
                <th className="px-4 py-3 text-right">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.glAccounts.map(acc => (
                <tr key={acc.accountCode}>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{acc.accountCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{acc.accountName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      acc.category === "ASSET" ? "bg-blue-100 text-blue-800" :
                      acc.category === "LIABILITY" ? "bg-amber-100 text-amber-800" :
                      acc.category === "REVENUE" ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"
                    }`}>
                      {acc.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{acc.debit > 0 ? `₹${acc.debit.toLocaleString()}` : "-"}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{acc.credit > 0 ? `₹${acc.credit.toLocaleString()}` : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-gray-900">
              <tr>
                <td colSpan={3} className="px-4 py-3 uppercase text-xs">Total Ledger Invariants</td>
                <td className="px-4 py-3 text-right font-mono">₹{data.balanceSheetCheck.totalDebits.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">₹{data.balanceSheetCheck.totalCredits.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tax Ledger View */}
      {activeTab === "tax" && data && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900">Output GST Tax Ledger Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold uppercase">CGST (Central Tax 9%)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">₹{data.summary.cgstPayable.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold uppercase">SGST (State Tax 9%)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">₹{data.summary.sgstPayable.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 font-semibold uppercase">IGST (Integrated Tax 18%)</p>
              <p className="text-xl font-bold text-gray-900 mt-1">₹{data.summary.igstPayable.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Aging View */}
      {activeTab === "aging" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Company Code</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3 text-right">0-30 Days</th>
                <th className="px-4 py-3 text-right">31-60 Days</th>
                <th className="px-4 py-3 text-right">61-90 Days</th>
                <th className="px-4 py-3 text-right text-red-600">90+ Days</th>
                <th className="px-4 py-3 text-right font-bold">Total Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agingData.map(acc => (
                <tr key={acc.companyId}>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{acc.companyCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{acc.companyName}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{acc.aging.current.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{acc.aging.days30.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{acc.aging.days60.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 font-semibold">₹{acc.aging.days90Plus.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">₹{acc.totalOutstanding.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
