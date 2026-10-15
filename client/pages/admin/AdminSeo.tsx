import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Edit,
  Trash2,
  BarChart3,
  ShieldCheck,
  MapPin,
  RefreshCw,
  TrendingUp,
  FileText,
  DollarSign,
  Eye,
  Sliders,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStoredAuthToken } from "@/lib/authStorage";

interface LandingPage {
  _id: string;
  slug: string;
  targetLocality: string;
  destinationName: string;
  pageType: string;
  distanceKm: number;
  travelTimeMinutes: { car: number; metro?: number; walking?: number };
  coordinates: { latitude: number; longitude: number };
  metaTitle: string;
  metaDescription: string;
  h1: string;
  h2Subheading: string;
  overviewContent: string;
  stayHighlights: string[];
  faqs: { question: string; answer: string }[];
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  verificationSource: string;
  isPublished: boolean;
  canonicalUrl: string;
  auditScore: number;
  analytics: {
    views: number;
    bookingStarts: number;
    completedBookings: number;
    revenueAttributed: number;
  };
  updatedAt: string;
}

export default function AdminSeo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getStoredAuthToken();

  const [activeTab, setActiveTab] = useState<"overview" | "pages" | "audit">("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    slug: "",
    targetLocality: "",
    destinationName: "",
    pageType: "LOCALITY",
    distanceKm: 0,
    travelTimeCar: 5,
    travelTimeMetro: 0,
    travelTimeWalk: 0,
    lat: 12.8715,
    lng: 77.6534,
    metaTitle: "",
    metaDescription: "",
    h1: "",
    h2Subheading: "",
    overviewContent: "",
    verificationSource: "YES HOTELS Ground Truth Audit",
    isPublished: true,
  });

  // Fetch admin pages
  const { data: pages = [], isLoading, refetch } = useQuery<LandingPage[]>({
    queryKey: ["admin-seo-pages"],
    queryFn: async () => {
      const res = await fetch("/api/seo/admin/pages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
  });

  // Fetch SEO Analytics
  const { data: analytics } = useQuery({
    queryKey: ["admin-seo-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/seo/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
  });

  // Fetch automated audit
  const { data: auditData, refetch: refetchAudit, isFetching: isAuditing } = useQuery({
    queryKey: ["admin-seo-audit"],
    queryFn: async () => {
      const res = await fetch("/api/seo/admin/audit", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
  });

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingPage ? `/api/seo/admin/pages/${editingPage._id}` : "/api/seo/admin/pages";
      const method = editingPage ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-audit"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-analytics"] });
      toast({
        title: "Page Saved",
        description: "SEO Landing page successfully saved and audit score computed.",
      });
      setIsModalOpen(false);
      setEditingPage(null);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Save",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/seo/admin/pages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-audit"] });
      toast({ title: "Page Deleted", description: "Landing page removed from index." });
    },
  });

  const handleOpenCreate = () => {
    setEditingPage(null);
    setFormData({
      slug: "",
      targetLocality: "",
      destinationName: "",
      pageType: "LOCALITY",
      distanceKm: 2.5,
      travelTimeCar: 8,
      travelTimeMetro: 4,
      travelTimeWalk: 0,
      lat: 12.8715,
      lng: 77.6534,
      metaTitle: "",
      metaDescription: "",
      h1: "",
      h2Subheading: "",
      overviewContent: "",
      verificationSource: "YES HOTELS Ground Truth Audit",
      isPublished: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (page: LandingPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      targetLocality: page.targetLocality,
      destinationName: page.destinationName,
      pageType: page.pageType,
      distanceKm: page.distanceKm,
      travelTimeCar: page.travelTimeMinutes?.car || 0,
      travelTimeMetro: page.travelTimeMinutes?.metro || 0,
      travelTimeWalk: page.travelTimeMinutes?.walking || 0,
      lat: page.coordinates?.latitude || 12.8715,
      lng: page.coordinates?.longitude || 77.6534,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      h1: page.h1,
      h2Subheading: page.h2Subheading,
      overviewContent: page.overviewContent,
      verificationSource: page.verificationSource,
      isPublished: page.isPublished,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      slug: formData.slug.toLowerCase().trim(),
      targetLocality: formData.targetLocality.trim(),
      destinationName: formData.destinationName.trim(),
      pageType: formData.pageType,
      distanceKm: Number(formData.distanceKm),
      distanceRouteDetails: `Direct connection along Hosur Main Road or via Yellow Line Metro network from Hosa Road Junction.`,
      travelTimeMinutes: {
        car: Number(formData.travelTimeCar),
        ...(Number(formData.travelTimeMetro) > 0 && { metro: Number(formData.travelTimeMetro) }),
        ...(Number(formData.travelTimeWalk) > 0 && { walking: Number(formData.travelTimeWalk) }),
      },
      coordinates: {
        latitude: Number(formData.lat),
        longitude: Number(formData.lng),
      },
      metaTitle: formData.metaTitle.trim(),
      metaDescription: formData.metaDescription.trim(),
      h1: formData.h1.trim(),
      h2Subheading: formData.h2Subheading.trim(),
      overviewContent: formData.overviewContent.trim(),
      verificationSource: formData.verificationSource.trim(),
      isPublished: formData.isPublished,
      stayHighlights: [
        "Modern AC rooms with 24-hour hot shower",
        "Free high-speed Wi-Fi and complimentary parking",
        "Elevator access and 24-hour front desk",
        "GST tax invoice on checkout for business claims",
      ],
      faqs: [
        {
          question: `How far is YES HOTELS from ${formData.destinationName}?`,
          answer: `YES HOTELS is approximately ${formData.distanceKm} km away on Hosur Main Road at Hosa Road Junction, about a ${formData.travelTimeCar}-minute drive.`,
        },
        {
          question: "Can I book rooms directly on the website for the best rate?",
          answer: "Yes, direct website bookings receive the guaranteed lowest rates without OTA commission fees.",
        },
      ],
    };

    saveMutation.mutate(payload);
  };

  const filteredPages = pages.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.targetLocality.toLowerCase().includes(q) ||
      p.destinationName.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
              Corridor Domination
            </span>
            <span className="text-xs text-slate-700">Bommasandra to Bommanahalli</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Local SEO & Direct Booking Discovery Engine
          </h1>
          <p className="text-xs text-slate-700 mt-0.5">
            Capture organic search demand across nearby corridors, hospitals, IT parks, and transit hubs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchAudit()}
            disabled={isAuditing}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={14} className={isAuditing ? "animate-spin" : ""} />
            <span>Run SEO Audit</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-lg bg-hotel-gold text-black text-xs font-bold uppercase tracking-wider hover:bg-hotel-gold/90 transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>New Landing Page</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-hotel-gold text-slate-900"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          <BarChart3 size={15} />
          <span>Attribution & Performance</span>
        </button>

        <button
          onClick={() => setActiveTab("pages")}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === "pages"
              ? "border-hotel-gold text-slate-900"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          <FileText size={15} />
          <span>Landing Pages Catalog ({pages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === "audit"
              ? "border-hotel-gold text-slate-900"
              : "border-transparent text-slate-700 hover:text-slate-900"
          }`}
        >
          <ShieldCheck size={15} />
          <span>Technical Audit & Health</span>
          {auditData?.summary?.flaggedPages > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
              {auditData.summary.flaggedPages}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ATTRIBUTION */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                Active Corridor Pages
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-slate-900">
                  {pages.filter((p) => p.isPublished).length}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">/ {pages.length} total</span>
              </div>
              <span className="text-[11px] text-slate-700 block mt-2">100% verified proximity</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                Organic Discovery Visits
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-slate-900">
                  {analytics?.totals?.views?.toLocaleString() || 0}
                </span>
                <Eye size={16} className="text-sky-500" />
              </div>
              <span className="text-[11px] text-slate-700 block mt-2">
                {analytics?.totals?.bookingStarts || 0} booking starts
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                Direct Attributed Bookings
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-emerald-600">
                  {analytics?.totals?.completedBookings || 0}
                </span>
                <span className="text-xs text-slate-700 font-medium">
                  ({analytics?.totals?.conversionRatePercent || 0}% conv)
                </span>
              </div>
              <span className="text-[11px] text-slate-700 block mt-2">Zero OTA commissions paid</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                Attributed Revenue
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-hotel-gold">
                  ₹{(analytics?.totals?.revenueAttributed || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <span className="text-[11px] text-slate-700 block mt-2">Captured from local search</span>
            </div>
          </div>

          {/* Top Converting Landing Pages */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Organic Landing Page Attribution Leaderboard
                </h3>
                <p className="text-xs text-slate-700">
                  Real completed reservations and revenue driven by each locality landing page.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700">Top 10 Performers</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Landing Page / URL</th>
                    <th className="py-3 px-4">Target Locality</th>
                    <th className="py-3 px-4 text-right">Page Views</th>
                    <th className="py-3 px-4 text-right">Booking Starts</th>
                    <th className="py-3 px-4 text-right">Confirmed Bookings</th>
                    <th className="py-3 px-4 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics?.topPerformingPages || []).map((p: any) => (
                    <tr key={p._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono text-slate-800 font-medium">
                        <a
                          href={`/hotels-near/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-hotel-gold transition inline-flex items-center gap-1.5"
                        >
                          <span>/hotels-near/{p.slug}</span>
                          <ExternalLink size={12} className="text-slate-700" />
                        </a>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{p.targetLocality}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{p.analytics?.views || 0}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{p.analytics?.bookingStarts || 0}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {p.analytics?.completedBookings || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-serif">
                        ₹{(p.analytics?.revenueAttributed || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {(!analytics?.topPerformingPages || analytics.topPerformingPages.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-700">
                        No attribution data recorded yet. Pages are primed to capture incoming organic traffic.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAGE MANAGER */}
      {activeTab === "pages" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <Search size={16} className="text-slate-700" />
            <input
              type="text"
              placeholder="Search by locality, destination name, or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
            />
          </div>

          {/* Pages Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Locality & Destination</th>
                    <th className="py-3.5 px-4">Distance from Hotel</th>
                    <th className="py-3.5 px-4">SEO Health</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Visits</th>
                    <th className="py-3.5 px-4">Bookings</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPages.map((page) => (
                    <tr key={page._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{page.targetLocality}</span>
                          <span className="text-[11px] text-slate-700">{page.destinationName}</span>
                          <span className="text-[10px] font-mono text-slate-700">/hotels-near/{page.slug}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin size={13} className="text-hotel-gold" />
                          <span>{page.distanceKm === 0 ? "0 km (At Base)" : `${page.distanceKm} km`}</span>
                        </span>
                        <span className="block text-[10px] text-slate-700">
                          {page.travelTimeMinutes?.car}m car / {page.travelTimeMinutes?.metro ? `${page.travelTimeMinutes.metro}m metro` : `${page.travelTimeMinutes?.walking || 0}m walk`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            page.auditScore >= 90
                              ? "bg-emerald-100 text-emerald-800"
                              : page.auditScore >= 75
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {page.auditScore}/100
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            page.isPublished
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {page.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700">{page.analytics?.views || 0}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">{page.analytics?.completedBookings || 0}</td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/hotels-near/${page.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Preview Page"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => handleOpenEdit(page)}
                            className="p-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Edit Page"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete landing page for ${page.targetLocality}?`)) {
                                deleteMutation.mutate(page._id);
                              }
                            }}
                            className="p-1.5 rounded text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Page"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TECHNICAL AUDIT */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                Automated Quality Gate
              </span>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                10-Point Technical SEO & Quality Audit
              </h2>
              <p className="text-xs text-slate-700 mt-1 max-w-xl">
                Evaluates meta title lengths, description bounds, H1 headings, content depth, proximity accuracy, Schema.org FAQ completeness, and canonical tags.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-3xl font-serif font-bold text-slate-900">
                  {auditData?.summary?.averageScore || 100}
                  <span className="text-sm font-sans font-normal text-slate-700"> / 100</span>
                </span>
                <span className="block text-[11px] font-semibold text-emerald-600">Average Health</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(auditData?.results || []).map((res: any) => (
              <div
                key={res._id}
                className={`p-4 rounded-xl border transition ${
                  res.passed
                    ? "bg-white border-slate-200"
                    : "bg-amber-50/50 border-amber-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {res.passed ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {res.targetLocality} — {res.destinationName}
                        </span>
                        <span className="text-xs font-mono text-slate-700">
                          /hotels-near/{res.slug}
                        </span>
                      </div>

                      {res.issues && res.issues.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {res.issues.map((iss: string, idx: number) => (
                            <li key={idx} className="text-xs text-amber-900 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>{iss}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-emerald-700 font-medium block mt-1">
                          All 10 SEO quality checks passed. 100% search-engine and crawler ready.
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      res.score >= 90
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Score: {res.score}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-7">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                {editingPage ? "Edit SEO Landing Page" : "Create New Local SEO Landing Page"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-700 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Target Locality *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electronic City"
                    value={formData.targetLocality}
                    onChange={(e) => setFormData({ ...formData, targetLocality: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electronic City Phase 1 & 2"
                    value={formData.destinationName}
                    onChange={(e) => setFormData({ ...formData, destinationName: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    URL Slug * (e.g. hotels-near-electronic-city)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="hotels-near-..."
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-hotel-gold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Page Type
                  </label>
                  <select
                    value={formData.pageType}
                    onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                  >
                    <option value="LOCALITY">Locality / Neighborhood</option>
                    <option value="IT_PARK">IT Park / Tech Hub</option>
                    <option value="HOSPITAL">Hospital / Healthcare</option>
                    <option value="INDUSTRIAL">Industrial Area</option>
                    <option value="TRANSIT">Metro / Transit Station</option>
                    <option value="ATTRACTION">Tourist / Attraction</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Distance (km) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={formData.distanceKm}
                    onChange={(e) => setFormData({ ...formData, distanceKm: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Drive (mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.travelTimeCar}
                    onChange={(e) => setFormData({ ...formData, travelTimeCar: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Metro (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.travelTimeMetro}
                    onChange={(e) => setFormData({ ...formData, travelTimeMetro: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Walk (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.travelTimeWalk}
                    onChange={(e) => setFormData({ ...formData, travelTimeWalk: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider">
                    Meta Title * (Recommended 30-65 chars)
                  </label>
                  <span className={formData.metaTitle.length > 70 ? "text-rose-600 font-bold" : "text-slate-700"}>
                    {formData.metaTitle.length}/70
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hotels Near Electronic City Bengaluru | YES HOTELS from ₹1,400"
                  value={formData.metaTitle}
                  onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider">
                    Meta Description * (Recommended 120-165 chars)
                  </label>
                  <span className={formData.metaDescription.length > 175 ? "text-rose-600 font-bold" : "text-slate-700"}>
                    {formData.metaDescription.length}/175
                  </span>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Compelling search snippet describing distance, AC rooms, Wi-Fi, 24-hr desk, and direct booking..."
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary H1 Heading *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boutique Hotel Near Electronic City, Bengaluru"
                  value={formData.h1}
                  onChange={(e) => setFormData({ ...formData, h1: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  H2 Subheading *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern, Comfortable AC Accommodation Right Beside Hosa Road Metro"
                  value={formData.h2Subheading}
                  onChange={(e) => setFormData({ ...formData, h2Subheading: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Overview Content *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detailed, authentic paragraph describing proximity, room quality, lift access, parking, and 24h reception..."
                  value={formData.overviewContent}
                  onChange={(e) => setFormData({ ...formData, overviewContent: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-hotel-gold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="publish-toggle"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded text-hotel-gold focus:ring-hotel-gold"
                />
                <label htmlFor="publish-toggle" className="font-semibold text-slate-800">
                  Publish page immediately to Google & sitemap
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-hotel-gold text-black font-bold uppercase tracking-wider hover:bg-hotel-gold/90 transition shadow-sm"
                >
                  {saveMutation.isPending ? "Saving..." : "Save Landing Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
