import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Demo/seed accounts (see server/src/scripts/seed.ts) — shown only outside
// production so a real deployment never advertises working credentials.
// Every role lands on a genuinely different part of the app: ADMIN/MANAGER/
// RECEPTIONIST go to /admin/dashboard (with role-scoped sidebar sections),
// HOUSEKEEPING and MAINTENANCE go to their own dedicated staff views, and
// CUSTOMER goes to the customer portal — these are not the same page.
const DEMO_ACCOUNTS: { role: string; email: string; password: string; note: string }[] = [
  { role: "Admin", email: "admin@yeshotels.com", password: "Admin@123", note: "Full admin panel — every module" },
  { role: "Manager", email: "manager@yeshotels.com", password: "Manager@123", note: "Admin panel minus Settings/Content" },
  { role: "Receptionist", email: "reception@yeshotels.com", password: "Reception@123", note: "Bookings, check-in/out, calendar" },
  { role: "Housekeeping", email: "housekeeping@yeshotels.com", password: "House@123", note: "Dedicated housekeeping view only" },
  { role: "Maintenance", email: "maintenance@yeshotels.com", password: "Main@123", note: "Dedicated maintenance view only" },
  { role: "Customer", email: "customer@yeshotels.com", password: "Customer@123", note: "Customer portal — bookings, profile" },
];

// Same verified, free-license Pixabay clip used on the homepage hero
// (Hero.tsx) — reused rather than a second asset so this doesn't cost the
// user a second multi-MB download if they've already visited the homepage
// (the browser's HTTP cache serves it instantly the second time).
const AUTH_VIDEO_URL = "https://cdn.pixabay.com/video/2024/02/29/202392-918066367_tiny.mp4";
const AUTH_VIDEO_POSTER = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const reducedMotion = useReducedMotion();

  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        login(data.data);
        toast({ title: "Welcome back", description: "Successfully logged in." });
        // Redirect based on role
        if (["ADMIN", "MANAGER", "RECEPTIONIST"].includes(data.data.role)) {
          navigate("/admin/dashboard");
        } else if (data.data.role === "HOUSEKEEPING") {
          navigate("/staff/housekeeping");
        } else if (data.data.role === "MAINTENANCE") {
          navigate("/staff/maintenance");
        } else {
          navigate("/customer/dashboard");
        }
      } else {
        toast({ title: "Login Failed", description: data.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Network error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Visual panel — hidden below lg to avoid shipping a video download
          on mobile where it would just be wasted bytes off-screen space. */}
      <div className="relative hidden overflow-hidden bg-hotel-black lg:block">
        {reducedMotion ? (
          <img src={AUTH_VIDEO_POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={AUTH_VIDEO_URL}
            poster={AUTH_VIDEO_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-hotel-black via-hotel-black/50 to-hotel-black/20" />
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 bottom-0 p-14"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-hotel-gold">Welcome Back</p>
          <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight text-hotel-white">
            Every stay begins with a moment of arrival.
          </h2>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-hotel-ivory px-4 py-16">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md bg-hotel-white p-8 border border-hotel-black/10"
        >
          <div className="text-center mb-8">
            <Link to="/" className="font-serif text-2xl text-hotel-black tracking-widest uppercase">YES HOTELS</Link>
            <h2 className="mt-4 text-xl font-serif text-hotel-black">Sign in to your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-hotel-black/70 mb-1">Email Address</label>
              <input
                id="login-email"
                type="email"
                required
                className="w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-hotel-black/70 mb-1">Password</label>
              <input
                id="login-password"
                type="password"
                required
                className="w-full border-b border-hotel-black/20 py-2 bg-transparent focus:outline-none focus:border-hotel-gold transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link to="/forgot-password" className="text-hotel-black/60 hover:text-hotel-gold transition-colors">
                Forgot your password?
              </Link>
            </div>

            <GoldButton className="w-full py-3" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </GoldButton>
          </form>

          <p className="mt-8 text-center text-sm text-hotel-black/60">
            Don't have an account?{" "}
            <Link to="/register" className="text-hotel-gold-text hover:underline">
              Register here
            </Link>
          </p>

          {!import.meta.env.PROD && (
            <div className="mt-8 border-t border-hotel-black/10 pt-6">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-hotel-black/50 mb-3">
                Demo Accounts (dev only)
              </p>
              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                    }}
                    className="w-full flex items-center justify-between gap-2 border border-hotel-black/10 px-3 py-2 text-left text-xs hover:border-hotel-gold hover:bg-hotel-ivory transition-colors"
                  >
                    <span>
                      <span className="font-semibold text-hotel-black">{acc.role}</span>
                      <span className="block text-hotel-black/50">{acc.note}</span>
                    </span>
                    <span className="shrink-0 text-hotel-gold-text">Fill</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
