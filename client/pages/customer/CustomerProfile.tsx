import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { GoldButton } from "@/components/hotel/HotelButtons";

export default function CustomerProfile() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: "",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, phone: form.phone }),
      });
      const data = await res.json();
      if (data.success) {
        login({ ...user!, firstName: form.firstName, lastName: form.lastName });
        toast({ title: "Profile updated", description: "Your information has been saved." });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-hotel-ivory">
      <div className="bg-hotel-black text-hotel-white px-6 py-4 flex items-center gap-4">
        <Link to="/customer/dashboard" className="font-serif text-lg tracking-widest uppercase text-hotel-gold">YES HOTELS</Link>
        <span className="text-hotel-white/30">/</span>
        <span className="text-hotel-white/70 text-sm">My Profile</span>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-serif text-3xl text-hotel-black mb-8">My Profile</h1>
        <div className="bg-hotel-white border border-hotel-black/10 p-8">
          <form onSubmit={handleProfileSave} className="space-y-6">
            <h3 className="font-medium text-hotel-black mb-4">Personal Information</h3>
            {[
              { key: "firstName", label: "First Name" },
              { key: "lastName", label: "Last Name" },
              { key: "phone", label: "Phone Number" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm text-hotel-black/60 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as any)[key]}
                  onChange={set(key)}
                  className="w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm text-hotel-black/60 mb-1">Email Address</label>
              <input type="email" value={user?.email ?? ""} disabled
                className="w-full border-b border-hotel-black/10 py-2 bg-transparent text-hotel-black/40 cursor-not-allowed" />
              <p className="text-xs text-hotel-black/40 mt-1">Email cannot be changed.</p>
            </div>
            <GoldButton type="submit" disabled={saving} className="px-8 py-2.5">
              {saving ? "Saving..." : "Save Changes"}
            </GoldButton>
          </form>
        </div>
      </div>
    </div>
  );
}
