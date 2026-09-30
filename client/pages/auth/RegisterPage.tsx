import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  Hotel, 
  Star, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck 
} from "lucide-react";

const LIGHT_HERO_IMAGE = "/gallery/hotel-59.jpg";

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
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
        toast({ title: "Welcome to YES HOTELS!", description: "Account created successfully." });
        navigate("/customer/dashboard");
      } else {
        toast({ title: "Registration Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] grid grid-cols-1 lg:grid-cols-12 text-slate-800 selection:bg-amber-100 selection:text-amber-900">
      {/* Left visual showcase — Light luxury aesthetic */}
      <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100/50 border-r border-amber-200/50">
        <div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-multiply" style={{ backgroundImage: `url(${LIGHT_HERO_IMAGE})` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#FDFBF7] via-transparent to-amber-50/80" />

        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-serif font-bold text-xl group-hover:scale-105 transition-transform">
              Y
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-wider text-slate-900 uppercase block leading-none">
                YES <span className="text-amber-600">HOTELS</span>
              </span>
              <span className="text-[10px] tracking-[0.25em] text-amber-700/80 font-medium uppercase">Luxurious Sanctuaries</span>
            </div>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 my-auto py-12 max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300/60 text-amber-900 text-xs font-semibold uppercase tracking-widest mb-6">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> Join Our Guest Privilege Program
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
            Unlock exclusive <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900">
              stay privileges.
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed font-light">
            Create an account to manage bookings, earn luxury rewards, request room customizations, and enjoy priority concierge service.
          </p>

          <div className="mt-8 space-y-3 border-t border-amber-200/60 pt-6">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Best rate guarantee on direct bookings
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Complimentary late check-out privileges
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" /> Secure digital key & instant desk check-in
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} YES HOTELS Group.
        </div>
      </div>

      {/* Right form section */}
      <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#FDFBF7]">
        <div className="flex lg:hidden items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-bold text-lg">
              Y
            </div>
            <span className="font-serif text-xl font-bold tracking-wider text-slate-900 uppercase">
              YES <span className="text-amber-600">HOTELS</span>
            </span>
          </Link>
          <Link to="/login" className="text-xs font-semibold text-amber-700 hover:text-amber-900">
            Sign In &rarr;
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white p-8 sm:p-10 rounded-2xl border border-stone-200/80 shadow-xl shadow-amber-900/5"
          >
            <div className="mb-6 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">Create Account</h2>
              <p className="mt-1 text-sm text-slate-500">
                Join YES HOTELS for an unparalleled luxury experience
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-firstName" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">First Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="reg-firstName"
                      type="text"
                      required
                      placeholder="Jane"
                      value={form.firstName}
                      onChange={set("firstName")}
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-lastName" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Last Name</label>
                  <input
                    id="reg-lastName"
                    type="text"
                    required
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={set("lastName")}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="jane.doe@example.com"
                    value={form.email}
                    onChange={set("email")}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={set("phone")}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={form.password}
                      onChange={set("password")}
                      className="w-full pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="reg-confirm"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={form.confirm}
                      onChange={set("confirm")}
                      className="w-full pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Complete Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center pt-5 border-t border-stone-100">
              <p className="text-xs text-slate-500">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-amber-700 hover:text-amber-900 hover:underline">
                  Sign in instead
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

