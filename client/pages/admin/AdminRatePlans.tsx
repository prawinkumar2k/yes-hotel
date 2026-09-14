import React, { useState, useEffect } from "react";
import { Tag, Plus, RefreshCw, CheckCircle2, ShieldCheck, Utensils, Percent, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

interface RatePlanItem {
  _id: string;
  name: string;
  code: string;
  mealPlan: "EP" | "CP" | "MAP" | "AP";
  multiplier: number;
  cancellationPolicy: string;
  isActive: boolean;
  notes?: string;
}

export default function AdminRatePlans() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlanItem[]>([]);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mealPlan, setMealPlan] = useState("CP");
  const [multiplier, setMultiplier] = useState("1.0");
  const [cancellationPolicy, setCancellationPolicy] = useState("Free cancellation up to 24h before check-in");
  const [submitting, setSubmitting] = useState(false);

  const fetchRatePlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rate-plans", { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setRatePlans(json.data || []);
      } else {
        toast({ title: "Failed to load rate plans", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatePlans();
  }, []);

  const handleCreateRatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/rate-plans", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name,
          code,
          mealPlan,
          multiplier: parseFloat(multiplier),
          cancellationPolicy,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Rate Plan Created", description: `Plan ${json.data.code} added.` });
        setShowCreateModal(false);
        setName("");
        setCode("");
        fetchRatePlans();
      } else {
        toast({ title: "Error", description: json.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getMealPlanBadge = (mp: string) => {
    switch (mp) {
      case "EP":
        return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded font-bold">Room Only (EP)</span>;
      case "CP":
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded font-bold">Continental CP (Breakfast)</span>;
      case "MAP":
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded font-bold">Half Board MAP (2 Meals)</span>;
      case "AP":
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded font-bold">Full Board AP (All Meals)</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded font-bold">{mp}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-hotel-gold" /> Dynamic Rate Plans & Meal Plan Packages
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure BAR, Corporate, CP, MAP, AP meal plan packages, and automated tariff multipliers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-hotel-gold hover:bg-amber-600 text-white rounded-lg transition text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Create Rate Plan
          </button>
          <button
            onClick={fetchRatePlans}
            className="flex items-center gap-2 px-4 py-2 bg-hotel-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Rate Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 text-center text-sm text-gray-500">Loading rate plans...</div>
        ) : (
          ratePlans.map((plan) => (
            <div key={plan._id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-hotel-gold transition">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold text-hotel-gold uppercase tracking-wider">{plan.code}</span>
                    <h3 className="text-lg font-serif font-bold text-gray-900">{plan.name}</h3>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2 py-1 rounded">
                    {plan.multiplier}x Tariff
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Utensils size={14} className="text-gray-400" />
                  {getMealPlanBadge(plan.mealPlan)}
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-700">Cancellation Policy:</p>
                  <p>{plan.cancellationPolicy}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Create Rate Plan */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateRatePlan} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Tag className="text-hotel-gold" /> Create New Rate Plan
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BAR / MAP"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs border rounded p-2.5 uppercase font-mono focus:ring-2 focus:ring-hotel-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Meal Package</label>
                <select
                  value={mealPlan}
                  onChange={(e) => setMealPlan(e.target.value)}
                  className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
                >
                  <option value="EP">EP — European Plan (Room Only)</option>
                  <option value="CP">CP — Continental Plan (Breakfast)</option>
                  <option value="MAP">MAP — Modified American (2 Meals)</option>
                  <option value="AP">AP — American Plan (All Meals)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Continental Bed & Breakfast Plan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tariff Multiplier (e.g. 1.0 for BAR, 1.15 for MAP) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cancellation Policy</label>
              <input
                type="text"
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                className="w-full text-xs border rounded p-2.5 focus:ring-2 focus:ring-hotel-gold outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 border rounded text-xs text-gray-700">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2 bg-hotel-gold hover:bg-amber-600 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50">
                {submitting ? "Saving..." : "Create Plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
