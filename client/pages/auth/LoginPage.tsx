import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { GoldButton } from "@/components/hotel/HotelButtons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
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
    <div className="min-h-screen flex items-center justify-center bg-hotel-ivory px-4">
      <div className="max-w-md w-full bg-hotel-white p-8 border border-hotel-black/10">
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
      </div>
    </div>
  );
}
