import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { GoldButton } from "@/components/hotel/HotelButtons";

const ID_TYPES = ["AADHAAR", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID", "PAN", "OTHER"];
const inputCls = "w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold transition-colors";
// Accounts created by "Booking no. + mobile" sign-in without an email get this placeholder address.
const isGeneratedEmail = (email?: string) => !!email && email.endsWith("@guests.yeshotels.local");

async function send(url: string, token: string | undefined, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function CustomerProfile() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await (await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${user?.token}` } })).json()).data,
    enabled: !!user,
  });

  const [form, setForm] = useState({ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", phone: "" });
  const [details, setDetails] = useState({ address: "", city: "", state: "", country: "India", idType: "", idNumber: "", company: "", gstin: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState<"" | "profile" | "details" | "password">("");

  useEffect(() => {
    if (!me) return;
    setForm({ firstName: me.firstName ?? "", lastName: me.lastName ?? "", phone: me.phone ?? "" });
    setDetails((d) => ({ ...d, ...(me.savedDetails ?? {}) }));
  }, [me]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving("profile");
    try {
      const data = await send("/api/auth/profile", user?.token, "PATCH", { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined });
      if (data.success) {
        login({ ...user!, firstName: form.firstName, lastName: form.lastName });
        qc.invalidateQueries({ queryKey: ["me"] });
        toast({ title: "Profile updated", description: "Your information has been saved." });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setSaving("");
    }
  };

  const handleDetailsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving("details");
    try {
      const data = await send("/api/auth/profile", user?.token, "PATCH", { savedDetails: details });
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["me"] });
        toast({ title: "Details saved", description: "They'll be filled in for you next time you book." });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setSaving("");
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSaving("password");
    try {
      const data = await send("/api/auth/change-password", user?.token, "POST", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      if (data.success) {
        login({ ...user!, token: data.data.token });
        setPw({ currentPassword: "", newPassword: "", confirm: "" });
        toast({ title: "Password changed", description: "Other devices have been signed out." });
      } else {
        toast({ title: "Password not changed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setSaving("");
    }
  };

  const email = me?.email ?? user?.email;

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <div className="bg-hotel-black text-hotel-white px-6 py-4 flex items-center gap-4">
        <Link to="/customer/dashboard" className="font-serif text-lg tracking-widest uppercase text-hotel-gold">YES HOTELS</Link>
        <span className="text-hotel-white/30">/</span>
        <span className="text-hotel-white/70 text-sm">My Profile</span>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="font-serif text-3xl text-hotel-black">My Profile</h1>

        <div className="bg-hotel-white border border-hotel-black/10 p-8">
          <form onSubmit={handleProfileSave} className="space-y-6">
            <h3 className="font-medium text-hotel-black mb-4">Personal Information</h3>
            {[
              { key: "firstName", label: "First Name" },
              { key: "lastName", label: "Last Name" },
              { key: "phone", label: "Phone Number" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm text-hotel-black/60 mb-1" htmlFor={`p-${key}`}>{label}</label>
                <input id={`p-${key}`} type="text" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputCls} />
              </div>
            ))}
            <div>
              <label className="block text-sm text-hotel-black/60 mb-1">Email Address</label>
              <input type="email" value={isGeneratedEmail(email) ? "Not provided" : email ?? ""} disabled className="w-full border-b border-hotel-black/10 py-2 bg-transparent text-hotel-black/40 cursor-not-allowed" />
              <p className="text-xs text-hotel-black/40 mt-1">Email cannot be changed here. Ask Reception if it needs correcting.</p>
            </div>
            <GoldButton type="submit" disabled={saving === "profile"} className="px-8 py-2.5">
              {saving === "profile" ? "Saving..." : "Save Changes"}
            </GoldButton>
          </form>
        </div>

        <div className="bg-hotel-white border border-hotel-black/10 p-8">
          <form onSubmit={handleDetailsSave} className="space-y-6">
            <div>
              <h3 className="font-medium text-hotel-black">Saved details for faster booking</h3>
              <p className="text-xs text-hotel-black/50 mt-1">Filled in for you on the guest details step when you book. Reception still checks your original ID at check-in.</p>
            </div>
            <div>
              <label className="block text-sm text-hotel-black/60 mb-1" htmlFor="d-address">Address</label>
              <input id="d-address" maxLength={300} value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {(["city", "state", "country"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-sm text-hotel-black/60 mb-1 capitalize" htmlFor={`d-${k}`}>{k}</label>
                  <input id={`d-${k}`} maxLength={80} value={details[k]} onChange={(e) => setDetails({ ...details, [k]: e.target.value })} className={inputCls} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-hotel-black/60 mb-1" htmlFor="d-idType">ID proof type</label>
                <select id="d-idType" value={details.idType} onChange={(e) => setDetails({ ...details, idType: e.target.value })} className={inputCls}>
                  <option value="">Select</option>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-hotel-black/60 mb-1" htmlFor="d-idNumber">ID number</label>
                <input id="d-idNumber" maxLength={40} value={details.idNumber} onChange={(e) => setDetails({ ...details, idNumber: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-hotel-black/60 mb-1" htmlFor="d-company">Company (for GST invoice)</label>
                <input id="d-company" maxLength={120} value={details.company} onChange={(e) => setDetails({ ...details, company: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-hotel-black/60 mb-1" htmlFor="d-gstin">GSTIN</label>
                <input id="d-gstin" maxLength={15} placeholder="15 characters" value={details.gstin} onChange={(e) => setDetails({ ...details, gstin: e.target.value.toUpperCase() })} className={`${inputCls} font-mono`} />
              </div>
            </div>
            <GoldButton type="submit" disabled={saving === "details"} className="px-8 py-2.5">
              {saving === "details" ? "Saving..." : "Save Details"}
            </GoldButton>
          </form>
        </div>

        <div className="bg-hotel-white border border-hotel-black/10 p-8">
          <h3 className="font-medium text-hotel-black mb-2">Password</h3>
          {isGeneratedEmail(email) ? (
            <p className="text-sm text-hotel-black/60">You sign in with your booking number and mobile number, so there's no password to manage.</p>
          ) : (
            <form onSubmit={handlePasswordSave} className="space-y-6">
              <p className="text-xs text-hotel-black/50">
                Signed in with your booking number and never set a password? Use <Link to="/forgot-password" className="text-hotel-gold hover:underline">Forgot password</Link> to create one.
              </p>
              {([["currentPassword", "Current password", "current-password"], ["newPassword", "New password (at least 8 characters)", "new-password"], ["confirm", "Confirm new password", "new-password"]] as const).map(([k, label, ac]) => (
                <div key={k}>
                  <label className="block text-sm text-hotel-black/60 mb-1" htmlFor={`pw-${k}`}>{label}</label>
                  <input id={`pw-${k}`} type="password" autoComplete={ac} required minLength={k === "currentPassword" ? 1 : 8} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} className={inputCls} />
                </div>
              ))}
              <GoldButton type="submit" disabled={saving === "password"} className="px-8 py-2.5">
                {saving === "password" ? "Saving..." : "Change Password"}
              </GoldButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
