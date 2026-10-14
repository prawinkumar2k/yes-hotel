import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Hotel, 
  Star, 
  ShieldCheck, 
  UserCheck, 
  Calendar, 
  Sparkles, 
  Wrench, 
  User, 
  ArrowRight,
  CheckCircle2,
  Key,
  CreditCard,
  UtensilsCrossed,
  Landmark,
  Phone,
  Hash
} from "lucide-react";


const LIGHT_HERO_IMAGE = "/gallery/hotel-60.jpg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mode, setMode] = useState<"password" | "booking">("password");
  const [bookingReference, setBookingReference] = useState("");
  const [mobile, setMobile] = useState("");
  const reducedMotion = useReducedMotion();

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(mode === "booking" ? "/api/auth/booking-login" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "booking" ? { bookingReference, mobile } : { email, password }),
      });
      // A rate-limit or proxy error may not be JSON; show the real reason, not "network error".
      const data = await res.json().catch(() => ({
        success: false,
        message: res.status === 429 ? "Too many failed attempts. Please wait 15 minutes and try again." : `Server error (${res.status}). Please try again.`,
      }));

      if (data.success) {
        login(data.data);
        toast({ title: "Welcome back", description: `Signed in as ${data.data.name || data.data.email}` });
        const role = data.data.role;
        const ROLE_ROUTES: Record<string, string> = {
          SUPER_ADMIN: "/admin/dashboard",
          ADMIN: "/admin/dashboard",
          MANAGER: "/admin/dashboard",
          SUPERVISOR: "/admin/dashboard",
          RECEPTIONIST: "/front-desk/dashboard",
          CASHIER: "/cashier/dashboard",
          HOUSEKEEPING: "/housekeeping/dashboard",
          MAINTENANCE: "/maintenance/dashboard",
          RESTAURANT: "/restaurant/dashboard",
          FINANCE: "/finance/dashboard",
          EVENTS: "/events/dashboard",
          INVENTORY: "/inventory/dashboard",
          PROCUREMENT: "/procurement/dashboard",
          CUSTOMER: "/customer/dashboard",
        };
        // Booking login opens the stay the guest just proved.
        navigate(mode === "booking" && data.data.bookingId ? `/customer/bookings/${data.data.bookingId}` : ROLE_ROUTES[role] || "/customer/dashboard");
      } else {
        toast({ title: "Login Failed", description: data.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Network connection error.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] grid grid-cols-1 lg:grid-cols-12 text-slate-800 selection:bg-amber-100 selection:text-amber-900">
      {/* Left visual showcase — Light luxury aesthetic */}
      <div className="lg:col-span-6 relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100/50 border-r border-amber-200/50">
        {/* Subtle background image overlay with soft light gradient */}
        <div className="absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-multiply" style={{ backgroundImage: `url(${LIGHT_HERO_IMAGE})` }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#FDFBF7] via-transparent to-amber-50/80" />

        {/* Brand logo top left */}
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-amber-200/60 shadow-sm text-xs font-medium text-amber-800">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>5-Star Premium Hospitality</span>
          </div>
        </div>

        {/* Center luxury experience message */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 my-auto py-12 max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300/60 text-amber-900 text-xs font-semibold uppercase tracking-widest mb-6">
            <Hotel className="w-3.5 h-3.5 text-amber-600" /> Welcome Back
          </div>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
            Elevated stays, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900">
              unmatched luxury.
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed font-light">
            Sign in to access your reservation itinerary, room service requests, concierge preferences, and staff operations management.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-amber-200/60 pt-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Instant Check-in</p>
                <p className="text-xs text-slate-500">Contactless digital key access</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Unified Portal</p>
                <p className="text-xs text-slate-500">Guests & staff operations sync</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex justify-between items-center border-t border-amber-200/40 pt-6">
          <span>&copy; {new Date().getFullYear()} YES HOTELS Group. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-amber-700 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-amber-700 transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Right form section — Clean white light card container */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#FDFBF7]">
        {/* Mobile Header Link */}
        <div className="flex lg:hidden items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-bold text-lg">
              Y
            </div>
            <span className="font-serif text-xl font-bold tracking-wider text-slate-900 uppercase">
              YES <span className="text-amber-600">HOTELS</span>
            </span>
          </Link>
          <Link to="/register" className="text-xs font-semibold text-amber-700 hover:text-amber-900">
            Create Account &rarr;
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-4">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white p-8 sm:p-10 rounded-2xl border border-stone-200/80 shadow-xl shadow-amber-900/5"
          >
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your credentials to access your YES HOTELS account
              </p>
            </div>

            {/* Sign-in method */}
            <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-xl bg-stone-100 border border-stone-200">
              {([["password", "Email & password"], ["booking", "Booking no. + mobile"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${mode === key ? "bg-white text-amber-800 shadow-sm border border-amber-200" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "booking" ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-xs text-slate-500 -mt-2">
                  Guests: no password needed. Use the booking number from your confirmation and the mobile number you booked with.
                </p>
                <div>
                  <label htmlFor="login-booking" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Booking Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      id="login-booking"
                      required
                      autoComplete="off"
                      placeholder="e.g. YH-20261014-0001"
                      value={bookingReference}
                      onChange={(e) => setBookingReference(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="login-mobile" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="login-mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      required
                      placeholder="10-digit mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || bookingReference.trim().length < 3 || mobile.replace(/\D/g, "").length < 10}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <span>Finding your booking...</span> : <><span>View My Booking</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-stone-50 border border-stone-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-medium">Keep me signed in</span>
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            )}

            <div className="mt-8 text-center pt-6 border-t border-stone-100">
              <p className="text-xs text-slate-500">
                Don't have an account yet?{" "}
                <Link to="/register" className="font-semibold text-amber-700 hover:text-amber-900 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

          </motion.div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden text-center text-xs text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} YES HOTELS Group
        </div>
      </div>
    </div>
  );
}

