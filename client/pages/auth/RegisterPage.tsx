import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { GoldButton } from "@/components/hotel/HotelButtons";

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        login(data.data);
        toast({ title: "Welcome!", description: "Account created successfully." });
        navigate("/customer/dashboard");
      } else {
        toast({ title: "Registration Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    { key: "firstName", label: "First Name", type: "text" },
    { key: "lastName", label: "Last Name", type: "text" },
    { key: "email", label: "Email Address", type: "email" },
    { key: "phone", label: "Phone (optional)", type: "tel" },
    { key: "password", label: "Password", type: "password" },
    { key: "confirm", label: "Confirm Password", type: "password" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-hotel-ivory px-4 py-12">
      <div className="max-w-md w-full bg-hotel-white p-8 border border-hotel-black/10">
        <div className="text-center mb-8">
          <Link to="/" className="font-serif text-2xl text-hotel-black tracking-widest uppercase">YES HOTELS</Link>
          <h2 className="mt-4 text-xl font-serif text-hotel-black">Create your account</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map(({ key, label, type }) => (
            <div key={key}>
              <label htmlFor={`register-${key}`} className="block text-sm font-medium text-hotel-black/70 mb-1">{label}</label>
              <input
                id={`register-${key}`}
                type={type}
                required={key !== "phone"}
                value={(form as any)[key]}
                onChange={set(key)}
                className="w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold transition-colors text-hotel-black"
              />
            </div>
          ))}
          <GoldButton className="w-full py-3 mt-2" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </GoldButton>
        </form>
        <p className="mt-6 text-center text-sm text-hotel-black/60">
          Already have an account?{" "}
          <Link to="/login" className="text-hotel-gold-text hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
